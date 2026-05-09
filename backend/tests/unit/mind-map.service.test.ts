import { generateMindMap } from '../../src/modules/ai/mind-map.service';
import { DocumentModel } from '../../src/modules/documents/document.model';
import { chatCompletionWithRetry } from '../../src/utils/llm';

jest.mock('../../src/modules/documents/document.model', () => ({
  DocumentModel: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('../../src/utils/llm', () => ({
  chatCompletionWithRetry: jest.fn(),
}));

const MockDocumentModel = DocumentModel as jest.Mocked<typeof DocumentModel>;
const mockChatCompletion = chatCompletionWithRetry as jest.Mock;

describe('Mind Map Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate and persist a mind map from extracted text', async () => {
    (MockDocumentModel.findById as jest.Mock).mockResolvedValue({
      _id: 'doc123',
      ownerId: { toString: () => 'user123' },
      originalName: 'Contrat.pdf',
      extractedText: 'Contrat de prestation. Obligations du fournisseur. Modalites de paiement.',
    });
    mockChatCompletion.mockResolvedValue(
      JSON.stringify({
        title: 'Contrat de prestation',
        summary: 'Vue generale du contrat.',
        root: {
          title: 'Contrat',
          children: [
            {
              title: 'Obligations',
              summary: 'Responsabilites du fournisseur.',
              children: [],
            },
          ],
        },
      })
    );

    const result = await generateMindMap('doc123', 'user123');

    expect(result.title).toBe('Contrat de prestation');
    expect(result.root.children[0].title).toBe('Obligations');
    expect(MockDocumentModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'doc123',
      expect.objectContaining({
        mindMap: expect.objectContaining({
          title: 'Contrat de prestation',
          root: expect.objectContaining({ title: 'Contrat' }),
        }),
      })
    );
  });

  it('should reject documents without extracted text', async () => {
    (MockDocumentModel.findById as jest.Mock).mockResolvedValue({
      _id: 'doc123',
      ownerId: { toString: () => 'user123' },
      originalName: 'Scan.pdf',
      extractedText: '',
    });

    await expect(generateMindMap('doc123', 'user123')).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(mockChatCompletion).not.toHaveBeenCalled();
    expect(MockDocumentModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
