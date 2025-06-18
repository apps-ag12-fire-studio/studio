
'use server';
/**
 * @fileOverview A Genkit flow for extracting structured personal and address data from a buyer's document image.
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
      "A photo of the buyer's personal document (e.g., RG, CNH, Comprovante de Endereço), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractBuyerDocumentDataInput = z.infer<typeof ExtractBuyerDocumentDataInputSchema>;

const ExtractBuyerDocumentDataOutputSchema = z.object({
  nomeCompleto: z.string().optional().describe('Nome completo do titular do documento ou da conta (no caso de comprovantes), conforme exibido ou contido no QR Code.'),
  cpf: z.string().optional().describe('Número do Cadastro de Pessoas Físicas (CPF) do titular, se visível ou contido no QR Code. Formatar como XXX.XXX.XXX-XX se possível.'),
  dataNascimento: z.string().optional().describe('Data de nascimento do titular, no formato DD/MM/AAAA, se visível ou contida no QR Code.'),
  nomeMae: z.string().optional().describe('Nome completo da mãe do titular, se visível ou contido no QR Code (comum em RGs).'),
  rg: z.string().optional().describe('Número do Registro Geral (RG) ou Carteira de Identidade. Extraia apenas os dígitos e informações do órgão emissor/UF que são claramente legíveis. Se partes estiverem obscurecidas por asteriscos ou ilegíveis, extraia apenas o que for visível. Se o campo inteiro for ilegível ou consistir principalmente de caracteres de mascaramento, omita este campo. Exemplo de extração ideal: "12.345.678-9 SSP/SP".'),
  logradouro: z.string().optional().describe('Logradouro completo, incluindo tipo (Rua, Avenida, Viela, etc.), nome, número e complemento, se houver. Ex: "R. Albanir Peres, 1415", "Av. Brasil, 1000, Apto 101".'),
  bairro: z.string().optional().describe('Bairro. Ex: "Vila Fatima", "Centro", "Setor Bueno".'),
  cidade: z.string().optional().describe('Cidade. Ex: "Jatai", "São Paulo".'),
  estado: z.string().optional().describe('Estado ou Unidade Federativa (UF), preferencialmente a sigla. Ex: "GO", "SP".'),
  cep: z.string().optional().describe('Código de Endereçamento Postal (CEP). Formatar como XXXXX-XXX ou XXXXXXXX se possível. Ex: "75.803-140", "75803140".'),
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
  prompt: `Você é um assistente de IA especialista em análise de documentos pessoais brasileiros, como documentos de identidade (RG, CNH) e comprovantes de endereço. Sua tarefa é extrair informações estruturadas de uma imagem de documento fornecida.

Instruções:
1.  **Verifique a Presença de QR Code:** Primeiramente, examine a imagem em busca de um QR Code.
2.  **Priorize o QR Code:** Se um QR Code for encontrado e puder ser decodificado, as informações extraídas dele devem ser consideradas a fonte primária.
3.  **Extração Visual (Fallback):** Se não houver QR Code, ou se ele estiver ilegível/danificado, ou não contiver todas as informações necessárias, extraia as informações do texto visível no documento.
4.  **Foco no Documento:** A imagem fornecida pode conter bordas ou fundo ao redor do documento real. Concentre sua análise estritamente no conteúdo do documento em si, ignorando o máximo possível as áreas de fundo ou bordas vazias.
5.  **Fidelidade:** Em todos os casos, priorize a fidelidade aos dados originais.
6.  **Campo RG - Instrução Específica:** Ao extrair o RG, concentre-se apenas nos números, letras e informações do órgão emissor/UF que são CLARAMENTE LEGÍVEIS. IGNORE e NÃO REPRODUZA longas sequências de asteriscos (***) ou outros caracteres de mascaramento. Se o número estiver quase totalmente obscurecido ou ilegível, deixe o campo 'rg' vazio.
7.  **Extração de Endereço:** Se o documento for um comprovante de endereço ou contiver informações de endereço, extraia os componentes do endereço nos campos apropriados (logradouro, bairro, cidade, estado, cep). Tente identificar tipos de logradouro como Rua (R.), Avenida (Av.), Viela, Estrada, Setor, Esquina, Centro, etc.
8.  **Campos Opcionais:** Se alguma informação não estiver claramente disponível ou não existir no documento, deixe o campo opcional correspondente vazio.

Analise a imagem do documento cuidadosamente e preencha os campos do schema de saída com a maior precisão possível.

Extraia informações sobre (se presentes e aplicáveis ao tipo de documento):
- Nome completo do titular do documento ou da conta.
- CPF do titular.
- Data de nascimento.
- Nome da mãe do titular.
- Número do RG.
- Endereço completo, incluindo:
  - Logradouro (Ex: "R. Albanir Peres, 1415", "Avenida Castelo Branco, Quadra X, Lote Y")
  - Bairro (Ex: "Vila Fatima", "Setor Marista")
  - Cidade (Ex: "Jatai", "Goiânia")
  - Estado (UF, Ex: "GO")
  - CEP (Ex: "75.803-140")

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

