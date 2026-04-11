export type ProfileLinkType = "linkedin" | "github" | "portfolio" | "twitter" | "other";

export type ProfileLink = {
  type: ProfileLinkType;
  url: string;
};

export type ExperienceItem = {
  role: string;
  company: string;
  start_date?: string;
  end_date?: string;
  description?: string;
};

export type EducationItem = {
  degree: string;
  institution: string;
  year?: string;
  description?: string;
};

export type VisibilitySettings = {
  phone: boolean;
  links: boolean;
  profile: boolean;
};

export type HrProfessionalProfile = {
  fullName: string;
  companyName: string;
  jobTitle: string;
  phone: string;
  location: string;
  website: string;
  bio: string;
  profilePicture: string;
  coverImage: string;
  profilePictureUrl?: string;
  coverImageUrl?: string;
  links: ProfileLink[];
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  visibilitySettings: VisibilitySettings;
  profileCompletionScore: number;
};

export const EMPTY_HR_PROFILE: HrProfessionalProfile = {
  fullName: "",
  companyName: "",
  jobTitle: "",
  phone: "",
  location: "",
  website: "",
  bio: "",
  profilePicture: "",
  coverImage: "",
  profilePictureUrl: "",
  coverImageUrl: "",
  links: [],
  experience: [],
  education: [],
  skills: [],
  visibilitySettings: {
    phone: true,
    links: true,
    profile: true,
  },
  profileCompletionScore: 0,
};
