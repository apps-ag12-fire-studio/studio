
'use server';
/**
 * @fileOverview A Genkit flow for extracting structured data from a contract image.
 *
 * - extractContractData - An exported function to initiate the data extraction process.
 * - ExtractContractDataInput - The input type for the extractContractData function.
 * - ExtractContractDataOutput - The return type for the extractContractData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractContractDataInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the contract, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractContractDataInput = z.infer<typeof ExtractContractDataInputSchema>;

const ExtractContractDataOutputSchema = z.object({
  nomesDasPartes: z.array(z.string()).optional().describe('Nomes completos das partes envolvidas no contrato (ex: Locador, Locatário, Comprador, Vendedor). Inclua a qualificação se disponível (ex: João Silva, CPF 123..., como LOCADOR).'),
  documentosDasPartes: z.array(z.string()).optional().describe('Documentos (CPF/CNPJ) das partes, se visíveis e associados aos nomes.'),
  objetoDoContrato: z.string().optional().describe('Descrição clara e concisa do objeto principal do contrato (ex: "Locação do imóvel situado na Rua Exemplo, nº 123", "Prestação de serviços de desenvolvimento de software").'),
  valorPrincipal: z.string().optional().describe('Valor principal do contrato (ex: "R$ 1.200,00 (mil e duzentos reais) mensais", "Preço total de R$ 50.000,00").'),
  condicoesDePagamento: z.string().optional().describe('Condições específicas de pagamento, como parcelamento, datas de vencimento, juros por atraso, multas, ou outras cláusulas financeiras relevantes, se explicitamente mencionadas (ex: "Pagamento em 3 parcelas mensais de R$ 400,00", "Entrada de R$ 10.000,00 e saldo em 10x R$ 4.000,00").'),
  prazoContrato: z.string().optional().describe('Prazo de vigência do contrato, incluindo data de início e término, se explicitamente mencionadas (ex: "Início em 01/01/2024 e término em 31/12/2024", "Prazo de 12 meses a contar da assinatura").'),
  localEDataAssinatura: z.string().optional().describe('Local e data de assinatura do contrato, se visível (ex: "São Paulo, 02 de Janeiro de 2024").'),
  foroEleito: z.string().optional().describe('Cidade ou comarca do foro de eleição para dirimir dúvidas, se mencionado (ex: "Foro da Comarca de Curitiba/PR").'),
  outrasObservacoesRelevantes: z.string().optional().describe('Quaisquer outras cláusulas ou observações que pareçam especialmente relevantes ou incomuns (ex: cláusula de confidencialidade específica, necessidade de testemunhas específicas, etc.).'),
});
export type ExtractContractDataOutput = z.infer<typeof ExtractContractDataOutputSchema>;

export async function extractContractData(
  input: ExtractContractDataInput
): Promise<ExtractContractDataOutput> {
  return extractContractDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractContractDataPrompt',
  input: {schema: ExtractContractDataInputSchema},
  output: {schema: ExtractContractDataOutputSchema},
  prompt: `Você é um assistente de IA especialista em análise de documentos contratuais. Sua tarefa é extrair informações estruturadas de uma imagem de contrato fornecida.
Analise a imagem do contrato cuidadosamente e preencha os campos do schema de saída com a maior precisão possível.
Se alguma informação não estiver claramente visível ou não existir no contrato, deixe o campo opcional correspondente vazio ou não o inclua na resposta.
Priorize a fidelidade ao texto do contrato. Extraia informações sobre:
- Nomes das partes e seus documentos.
- Objeto do contrato.
- Valor principal.
- Condições de pagamento detalhadas (parcelamento, datas, juros, multas).
- Prazo do contrato.
- Local e data da assinatura.
- Foro eleito.
- Outras observações relevantes.

Contrato (Imagem): {{media url=photoDataUri}}`,
});

const extractContractDataFlow = ai.defineFlow(
  {
    name: 'extractContractDataFlow',
    inputSchema: ExtractContractDataInputSchema,
    outputSchema: ExtractContractDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("A IA não conseguiu extrair os dados do contrato.");
    }
    return output;
  }
);
