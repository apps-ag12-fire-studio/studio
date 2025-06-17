
'use server';
/**
 * @fileOverview A Genkit flow for extracting structured personal data from a buyer's document image.
 *
 * - extractBuyerDocumentData - An exported function to initiate the data extraction process.
 * - ExtractBuyerDocumentDataInput - The input type for the extractBuyerDocumentData function.
 * - ExtractBuyerDocumentDataOutput - The return type for the extractBuyerDocumentData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractBuyerDocumentDataInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the buyer's personal document (e.g., RG, CNH), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractBuyerDocumentDataInput = z.infer<typeof ExtractBuyerDocumentDataInputSchema>;

const ExtractBuyerDocumentDataOutputSchema = z.object({
  nomeCompleto: z.string().optional().describe('Nome completo do titular do documento, conforme exibido.'),
  cpf: z.string().optional().describe('Número do Cadastro de Pessoas Físicas (CPF) do titular, se visível. Formatar como XXX.XXX.XXX-XX se possível.'),
  dataNascimento: z.string().optional().describe('Data de nascimento do titular, no formato DD/MM/AAAA, se visível.'),
  nomeMae: z.string().optional().describe('Nome completo da mãe do titular, se visível (comum em RGs).'),
  rg: z.string().optional().describe('Número do Registro Geral (RG) ou Carteira de Identidade, incluindo órgão emissor e UF se disponíveis (ex: 12.345.678-9 SSP/SP), se visível.'),
});
export type ExtractBuyerDocumentDataOutput = z.infer<typeof ExtractBuyerDocumentDataOutputSchema>;

export async function extractBuyerDocumentData(
  input: ExtractBuyerDocumentDataInput
): Promise<ExtractBuyerDocumentDataOutput> {
  return extractBuyerDocumentDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractBuyerDocumentDataPrompt',
  input: {schema: ExtractBuyerDocumentDataInputSchema},
  output: {schema: ExtractBuyerDocumentDataOutputSchema},
  prompt: `Você é um assistente de IA especialista em análise de documentos de identidade brasileiros (como RG, CNH). Sua tarefa é extrair informações estruturadas de uma imagem de documento fornecida.
Analise a imagem do documento cuidadosamente e preencha os campos do schema de saída com a maior precisão possível.
Se alguma informação não estiver claramente visível ou não existir no documento, deixe o campo opcional correspondente vazio ou não o inclua na resposta.
Priorize a fidelidade ao texto do documento. Extraia informações sobre:
- Nome completo do titular.
- CPF do titular (formate como XXX.XXX.XXX-XX se possível).
- Data de nascimento (formate como DD/MM/AAAA).
- Nome da mãe do titular.
- Número do RG (incluindo órgão emissor e UF, se disponível).

Documento (Imagem): {{media url=photoDataUri}}`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
});

const extractBuyerDocumentDataFlow = ai.defineFlow(
  {
    name: 'extractBuyerDocumentDataFlow',
    inputSchema: ExtractBuyerDocumentDataInputSchema,
    outputSchema: ExtractBuyerDocumentDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("A IA não conseguiu extrair os dados do documento do comprador.");
    }
    return output;
  }
);
