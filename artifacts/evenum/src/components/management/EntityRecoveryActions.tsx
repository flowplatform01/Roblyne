import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import {
  getGetCampaignQueryKey,
  getGetElectionQueryKey,
  getGetEventQueryKey,
  getListCampaignsQueryKey,
  getListElectionsQueryKey,
  getListEventsQueryKey,
  useDeleteCampaign,
  useDeleteElection,
  useDeleteEvent,
  useUpdateCampaign,
  useUpdateElection,
  useUpdateEvent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type EntityKind = "event" | "campaign" | "election";

type EditableEntity = {
  id: number;
  orgId: number;
  title: string;
  description?: string | null;
  status: string;
  location?: string | null;
  isOnline?: boolean;
  onlineUrl?: string | null;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  capacity?: number | null;
};

type DetailsDraft = {
  title: string;
  description: string;
  location: string;
  isOnline: boolean;
  onlineUrl: string;
  startsAt: string;
  endsAt: string;
  capacity: string;
};

function toLocalDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function makeDraft(entity: EditableEntity): DetailsDraft {
  return {
    title: entity.title,
    description: entity.description ?? "",
    location: entity.location ?? "",
    isOnline: Boolean(entity.isOnline),
    onlineUrl: entity.onlineUrl ?? "",
    startsAt: toLocalDateTime(entity.startsAt),
    endsAt: toLocalDateTime(entity.endsAt),
    capacity: entity.capacity == null ? "" : String(entity.capacity),
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: { error?: string } } | null)?.data;
  return data?.error || fallback;
}

export function EntityRecoveryActions({
  kind,
  entity,
}: {
  kind: EntityKind;
  entity: EditableEntity;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState(() => makeDraft(entity));
  const updateEvent = useUpdateEvent();
  const updateCampaign = useUpdateCampaign();
  const updateElection = useUpdateElection();
  const deleteEvent = useDeleteEvent();
  const deleteCampaign = useDeleteCampaign();
  const deleteElection = useDeleteElection();

  useEffect(() => {
    if (editOpen) setDraft(makeDraft(entity));
  }, [
    editOpen,
    entity.title,
    entity.description,
    entity.location,
    entity.isOnline,
    entity.onlineUrl,
    entity.startsAt,
    entity.endsAt,
    entity.capacity,
  ]);

  const isSaving = updateEvent.isPending || updateCampaign.isPending || updateElection.isPending;
  const isDeleting = deleteEvent.isPending || deleteCampaign.isPending || deleteElection.isPending;

  const invalidateEntity = () => {
    if (kind === "event") {
      void queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(entity.id) });
      void queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
    } else if (kind === "campaign") {
      void queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(entity.id) });
      void queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
    } else {
      void queryClient.invalidateQueries({ queryKey: getGetElectionQueryKey(entity.id) });
      void queryClient.invalidateQueries({ queryKey: getListElectionsQueryKey() });
    }
  };

  const saveDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      toast({ title: "A title is required", variant: "destructive" });
      return;
    }

    const onSuccess = () => {
      invalidateEntity();
      setEditOpen(false);
      toast({ title: "Details saved", description: "The updated information is now available on the public page." });
    };
    const onError = (error: unknown) => {
      toast({
        title: "Could not save changes",
        description: getErrorMessage(error, "Please review the details and try again."),
        variant: "destructive",
      });
    };
    const common = { title, description: draft.description };

    if (kind === "event") {
      const initial = makeDraft(entity);
      const data: {
        title: string;
        description: string;
        location?: string;
        isOnline?: boolean;
        onlineUrl?: string;
        startsAt?: string;
        endsAt?: string;
        capacity?: number;
      } = { ...common };
      if (draft.location !== initial.location) data.location = draft.location;
      if (draft.isOnline !== initial.isOnline) data.isOnline = draft.isOnline;
      if (draft.onlineUrl !== initial.onlineUrl) data.onlineUrl = draft.onlineUrl;
      if (draft.startsAt && draft.startsAt !== initial.startsAt) {
        data.startsAt = new Date(draft.startsAt).toISOString();
      }
      if (draft.endsAt && draft.endsAt !== initial.endsAt) {
        data.endsAt = new Date(draft.endsAt).toISOString();
      }
      if (draft.capacity && draft.capacity !== initial.capacity) {
        const capacity = Number(draft.capacity);
        if (!Number.isInteger(capacity) || capacity < 1) {
          toast({ title: "Capacity must be a positive whole number", variant: "destructive" });
          return;
        }
        data.capacity = capacity;
      }
      updateEvent.mutate({ eventId: entity.id, data }, { onSuccess, onError });
      return;
    }

    if (kind === "campaign") {
      updateCampaign.mutate({ campaignId: entity.id, data: common }, { onSuccess, onError });
      return;
    }

    updateElection.mutate({ electionId: entity.id, data: common }, { onSuccess, onError });
  };

  const removeDraft = () => {
    const onSuccess = () => {
      invalidateEntity();
      setDeleteOpen(false);
      toast({ title: `${kind[0].toUpperCase()}${kind.slice(1)} deleted` });
      setLocation(`/organizations/${entity.orgId}?tab=${kind === "event" ? "events" : kind === "campaign" ? "campaigns" : "elections"}`);
    };
    const onError = (error: unknown) => {
      toast({
        title: `Could not delete ${kind}`,
        description: getErrorMessage(error, "This item may have activity or payment history that must be preserved."),
        variant: "destructive",
      });
    };
    if (kind === "event") deleteEvent.mutate({ eventId: entity.id }, { onSuccess, onError });
    else if (kind === "campaign") deleteCampaign.mutate({ campaignId: entity.id }, { onSuccess, onError });
    else deleteElection.mutate({ electionId: entity.id }, { onSuccess, onError });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        Edit details
      </Button>
      {entity.status === "draft" && (
        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete draft
        </Button>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit {kind} details</DialogTitle>
            <DialogDescription>
              Changes to the title and description appear on the public page. Financial records and participation history are not changed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveDetails} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${kind}-edit-title`}>Title</Label>
              <Input
                id={`${kind}-edit-title`}
                autoFocus
                required
                maxLength={200}
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${kind}-edit-description`}>Description</Label>
              <Textarea
                id={`${kind}-edit-description`}
                rows={5}
                maxLength={10000}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              />
            </div>

            {kind === "event" && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarClock className="h-4 w-4" />
                  Event logistics
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave schedule or capacity blank/unchanged to keep the current value. Once a ticket or pending payment exists, the server protects schedule, capacity, visibility, and attendee location details.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="event-edit-location">Location</Label>
                  <Input
                    id="event-edit-location"
                    value={draft.location}
                    onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.isOnline}
                    onChange={(event) => setDraft((current) => ({ ...current, isOnline: event.target.checked }))}
                    className="h-4 w-4 accent-primary"
                  />
                  This is an online event
                </label>
                {draft.isOnline && (
                  <div className="space-y-2">
                    <Label htmlFor="event-edit-online-url">Online event link</Label>
                    <Input
                      id="event-edit-online-url"
                      type="url"
                      value={draft.onlineUrl}
                      onChange={(event) => setDraft((current) => ({ ...current, onlineUrl: event.target.value }))}
                    />
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="event-edit-start">Starts</Label>
                    <Input
                      id="event-edit-start"
                      type="datetime-local"
                      value={draft.startsAt}
                      onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-edit-end">Ends</Label>
                    <Input
                      id="event-edit-end"
                      type="datetime-local"
                      value={draft.endsAt}
                      onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-edit-capacity">Capacity</Label>
                  <Input
                    id="event-edit-capacity"
                    type="number"
                    min={1}
                    step={1}
                    value={draft.capacity}
                    onChange={(event) => setDraft((current) => ({ ...current, capacity: event.target.value }))}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft {kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{entity.title}” will be permanently removed. Deletion is allowed only when there are no participants, ballots, submissions, tickets, or payment attempts to preserve. Published or active items must be cancelled or ended instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep draft</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                removeDraft();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
