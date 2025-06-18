
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
  nomeCompleto: z.string().optional().describe('Nome completo do titular do documento, conforme exibido ou contido no QR Code.'),
  cpf: z.string().optional().describe('Número do Cadastro de Pessoas Físicas (CPF) do titular, se visível ou contido no QR Code. Formatar como XXX.XXX.XXX-XX se possível.'),
  dataNascimento: z.string().optional().describe('Data de nascimento do titular, no formato DD/MM/AAAA, se visível ou contida no QR Code.'),
  nomeMae: z.string().optional().describe('Nome completo da mãe do titular, se visível ou contido no QR Code (comum em RGs).'),
  rg: z.string().optional().describe('Número do Registro Geral (RG) ou Carteira de Identidade. Extraia apenas os dígitos e informações do órgão emissor/UF que são claramente legíveis. Se partes estiverem obscurecidas por asteriscos ou ilegíveis, extraia apenas o que for visível. Se o campo inteiro for ilegível ou consistir principalmente de caracteres de mascaramento, omita este campo. Exemplo de extração ideal: "12.345.678-9 SSP/SP".'),
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
  prompt: `Você é um assistente de IA especialista em análise de documentos de identidade brasileiros (como RG, CNH), incluindo a decodificação de QR Codes presentes nesses documentos. Sua tarefa é extrair informações estruturadas de uma imagem de documento fornecida.

Instruções:
1.  **Verifique a Presença de QR Code:** Primeiramente, examine a imagem em busca de um QR Code.
2.  **Priorize o QR Code:** Se um QR Code for encontrado e puder ser decodificado, as informações extraídas dele (como nome, CPF, data de nascimento, RG, nome da mãe) devem ser consideradas a fonte primária e mais confiável de dados. Preencha os campos do schema de saída com base nesses dados.
3.  **Extração Visual (Fallback):** Se não houver QR Code, ou se ele estiver ilegível, danificado ou não contiver todas as informações necessárias, extraia as informações faltantes do texto visível no documento.
4.  **Fidelidade:** Em todos os casos (QR Code ou visual), priorize a fidelidade aos dados originais.
5.  **Campo RG - Instrução Específica:** Ao extrair o RG, concentre-se apenas nos números, letras e informações do órgão emissor/UF que são CLARAMENTE LEGÍVEIS. IGNORE e NÃO REPRODUZA longas sequências de asteriscos (***) ou outros caracteres de mascaramento que possam estar na imagem para ocultar partes do número. Se o número estiver quase totalmente obscurecido ou ilegível, deixe o campo 'rg' vazio. O objetivo é capturar o valor real do RG, não a sua representação mascarada.
6.  **Campos Opcionais:** Se alguma informação não estiver claramente disponível (seja no QR Code ou no texto) ou não existir no documento, deixe o campo opcional correspondente vazio ou não o inclua na resposta.

Analise a imagem do documento cuidadosamente e preencha os campos do schema de saída com a maior precisão possível, seguindo as prioridades acima.

Extraia informações sobre:
- Nome completo do titular.
- CPF do titular (formate como XXX.XXX.XXX-XX se possível).
- Data de nascimento (formate como DD/MM/AAAA).
- Nome da mãe do titular.
- Número do RG (incluindo órgão emissor e UF, se disponível, e seguindo a instrução específica para RG).

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

