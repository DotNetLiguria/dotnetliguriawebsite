import { TrackModel } from "./TrackModel";
import { LocationModel } from "./LocationModel";
import { WorkshopFileModel } from "./WorkshopFileModel";

export interface WorkshopTalkSpeakerModel {
  workshopSpeakerId?: string;
  sessionizeId?: string;
  name: string;
  imageUrl?: string;
  photoFallbackDisabled?: boolean;
  biography?: string;
}

export interface WorkshopTalkModel {
  workshopTalkId: string;
  sessionizeId?: string;
  trackId?: string | null;
  title: string;
  abstract?: string;
  sessionType: string;
  speakers: WorkshopTalkSpeakerModel[];
}

export interface WorkshopAgendaTrackModel {
  workshopAgendaTrackId: string;
  name: string;
  order: number;
}

export interface WorkshopAgendaItemModel {
  workshopAgendaItemId: string;
  itemType: "talk" | "break" | "service";
  talkId?: string | null;
  trackId?: string | null;
  order?: number;
  title?: string;
  roomName?: string;
  startTime: Date | string;
  endTime: Date | string;
}

export interface WorkshopModel {
  workshopId: string;
  title: string;
  description: string;
  creationDate: Date;
  eventDate: Date;
  blogHtml: string;
  image: string;
  tags: string;
  published: boolean;
  in_homepage: boolean;
  isExternalEvent: boolean;
  externalRegistration: boolean;
  externalRegistrationLink: string;
  onlyHtml: boolean;
  location: LocationModel;
  tracks: TrackModel[];
  talks?: WorkshopTalkModel[];
  agendaTracks?: WorkshopAgendaTrackModel[];
  agendaItems?: WorkshopAgendaItemModel[];
  attendeeNotes?: string;
  bookingServiceUrl?: string;
  eventbriteTicketCapacity?: number;
  eventbriteSyncedTicketCapacity?: number;
  eventbriteSalesStart?: string;
  eventbriteSalesEnd?: string;
  eventbriteEventId?: string;
  eventbriteEventUrl?: string;
  eventbriteSyncStatus?: string;
  eventbriteLastError?: string;
  eventbriteLastSyncedAt?: Date | string;
  eventbritePublished?: boolean;
  oldUrl: string;
  slug: string;
  materials: WorkshopFileModel[];
  photos: WorkshopFileModel[];
}
