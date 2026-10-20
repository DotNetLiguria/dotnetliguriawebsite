export interface BoardProfileModel {
  id: string;
  boardId: string;
  name: string;
  order?: number;
  email: string;
  imageUrl: string;
  profileImageUrl: string;
  photoFallbackDisabled?: boolean;
  profileBio: string;
  shortBio?: string;
  description?: string;
  lInkedinUrl?: string;
  gitHubUrl?: string;
  faceboookUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  blogHtml?: string;
  isActive?: boolean;
}
