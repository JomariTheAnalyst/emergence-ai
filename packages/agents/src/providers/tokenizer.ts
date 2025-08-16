/**
 * Simple token counting utility
 * 
 * Note: This is a simple approximation. For production use,
 * consider using model-specific tokenizers like tiktoken for OpenAI models
 * or the Anthropic tokenizer for Claude models.
 */

/**
 * Estimate token count for a string
 * This is a simple approximation based on the average token length
 * 
 * @param text The text to count tokens for
 * @returns Estimated token count
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  
  // Simple approximation: ~4 characters per token for English text
  // This is a rough estimate and will vary by model and content
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token count for a JSON object
 * 
 * @param obj The object to count tokens for
 * @returns Estimated token count
 */
export function countJsonTokens(obj: any): number {
  const json = JSON.stringify(obj);
  return countTokens(json);
}

/**
 * Truncate text to fit within a token limit
 * 
 * @param text The text to truncate
 * @param maxTokens Maximum number of tokens
 * @returns Truncated text
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  if (countTokens(text) <= maxTokens) {
    return text;
  }
  
  // Simple approximation: truncate to character count
  const approxCharLimit = maxTokens * 4;
  return text.substring(0, approxCharLimit);
}

/**
 * Split text into chunks of specified token size
 * 
 * @param text The text to split
 * @param chunkSize Maximum tokens per chunk
 * @param overlap Number of tokens to overlap between chunks
 * @returns Array of text chunks
 */
export function splitIntoChunks(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 100
): string[] {
  const chunks: string[] = [];
  const approxCharSize = chunkSize * 4;
  const approxCharOverlap = overlap * 4;
  
  let startIndex = 0;
  
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + approxCharSize, text.length);
    chunks.push(text.substring(startIndex, endIndex));
    startIndex = endIndex - approxCharOverlap;
    
    // Avoid infinite loop if overlap >= chunkSize
    if (startIndex >= endIndex) {
      break;
    }
  }
  
  return chunks;
}

