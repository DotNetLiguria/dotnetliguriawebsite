export type NewsletterKind = 'event' | 'generic';
export interface Attempt {
  id: string;
  mode: string;
  recipient: string;
  status: string;
  occurredAt: string;
  errorCode?: string;
  messageId?: string;
  reconciliationRequired?: boolean;
  reconciliationOutcome?: 'accepted' | 'not-submitted';
}
export interface Newsletter {
  id: string;
  kind: NewsletterKind;
  title: string;
  subject: string;
  markdown: string;
  version: number;
  templateId?: string;
  templateVersion?: number;
  eventId?: string;
  archived: boolean;
  productionStatus: string;
  updatedAt: string;
  attempts?: Attempt[];
}
export interface NewsletterTemplate {
  id: string;
  kind: NewsletterKind;
  name: string;
  subject: string;
  markdown: string;
  version: number;
  archived: boolean;
}
export interface NewsletterConfig {
  defaultTestAddress: string;
  distributionAddress: string;
  testEnabled: boolean;
  productionEnabled: boolean;
  maxImageBytes: number;
}
export interface NewsletterEvent {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  locationName?: string;
}
export interface PreviewImage { cid: string; contentType: string; base64: string }
export interface RenderedPreview {
  subject: string;
  html: string;
  plainText: string;
  images: PreviewImage[];
  warnings: string[];
}
export interface NewsletterPreview extends RenderedPreview {
  snapshotId: string;
  contentHash: string;
  messageBytes: number;
}
export interface Confirmation {
  confirmationId: string;
  expiresAt: string;
  distributionAddress: string;
}
