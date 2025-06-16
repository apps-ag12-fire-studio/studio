'use server';

/**
 * @fileOverview This file defines a Genkit flow for verifying the completeness and clarity of a captured contract photo.
 *
 * It includes:
 * - verifyContractPhoto: An exported function to initiate the verification process.
 * - VerifyContractPhotoInput: The input type for the verifyContractPhoto function.
 * - VerifyContractPhotoOutput: The output type for the verifyContractPhoto function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VerifyContractPhotoInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the contract, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type VerifyContractPhotoInput = z.infer<typeof VerifyContractPhotoInputSchema>;

const VerifyContractPhotoOutputSchema = z.object({
  isCompleteAndClear: z
    .boolean()
    .describe(
      'Whether or not the contract photo is complete and clear, meaning all parts of the contract are visible and readable.'
    ),
  reason: z
    .string()
    .optional()
    .describe(
      'If the contract photo is not complete and clear, the reason why.'
    ),
});
export type VerifyContractPhotoOutput = z.infer<typeof VerifyContractPhotoOutputSchema>;

export async function verifyContractPhoto(
  input: VerifyContractPhotoInput
): Promise<VerifyContractPhotoOutput> {
  return verifyContractPhotoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'verifyContractPhotoPrompt',
  input: {schema: VerifyContractPhotoInputSchema},
  output: {schema: VerifyContractPhotoOutputSchema},
  prompt: `You are an AI assistant specializing in verifying the completeness and clarity of contract photos.

You will receive a photo of a contract and must determine if it is complete and clear.
Complete means that all parts of the contract are visible in the photo. Clear means that all text in the contract is readable.

If the photo is complete and clear, return isCompleteAndClear as true.
If the photo is not complete and clear, return isCompleteAndClear as false and provide a reason why in the reason field.

Contract Photo: {{media url=photoDataUri}}`,
});

const verifyContractPhotoFlow = ai.defineFlow(
  {
    name: 'verifyContractPhotoFlow',
    inputSchema: VerifyContractPhotoInputSchema,
    outputSchema: VerifyContractPhotoOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
