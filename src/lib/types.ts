export const UNCLE_THRESHOLD = 60;

export type Trait = { label: string; hit: boolean };

export type Analysis = {
  safe: boolean;
  score: number; // 0-100 "uncle-ness"
  verdict: string;
  traits: Trait[];
  tips: string[];
  token: string; // signed proof that the server analyzed exactly this image
};

export type Photo = {
  id: string;
  url: string;
  caption: string;
  score: number;
  verdict: string;
  likes: number;
  created_at: string;
};
