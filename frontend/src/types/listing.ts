import { JobStatusValue } from "./jobStatus";

export interface Listing {
  id:              number;
  title:           string;
  company:         string | null;
  location:        string | null;  // pre-combined "{CITY}, {STATE}" from Step 02
  salary_min:      number | null;  // normalized annual
  salary_max:      number | null;  // normalized annual
  pay_interval:    string | null;  // "yearly" | "hourly"
  job_type:        string | null;
  is_remote:       boolean;        // inferred boolean from Step 02
  source_url:      string | null;  // aggregator link — use this for "View Posting"
  source_platform: string | null;  // "indeed" | "linkedin" | "zip_recruiter"
  status:          JobStatusValue;
  posted_at:       string | null;
  target_company:  string | null;  // non-null when found via targeted company search
}
