export type EmbeddingVector = number[];

export type AtsResult = {
  applicationId: string;
  jobId: string;
  atsScore: number;
  similarity: number;
  extractedTextLength: number;
};
