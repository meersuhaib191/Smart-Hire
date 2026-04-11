export type PublicJob = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  submission_deadline_at?: string | null;
  company: string;
  skills: string[];
};

export type JobFilters = {
  query: string;
  location: string;
  types: string[];
  levels: string[];
  salaryMin: number;
  salaryMax: number;
};

export type SanitizedJob = PublicJob & {
  title: string;
  company: string;
  locationLabel: string;
  typeLabel: string;
  experienceLabel: string;
  salaryLabel: string;
};
