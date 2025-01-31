import * as vscode from "vscode";
import OpenAI from "openai";
import { config } from "dotenv";

// Load environment variables from .env file
config({ path: ".env" });

// Initialize the OpenAI client with the NVIDIA API endpoint
const openai = new OpenAI({
  apiKey: process.env.SECRET_KEY, // Ensure this is set in your .env file
  baseURL: process.env.BASE_URL, // NVIDIA API endpoint
});

/**
 * Fetches code completion suggestions from the AI model.
 * @param document - The active text document in VS Code.
 * @param position - The current cursor position in the document.
 * @returns A promise resolving to the suggested code completion.
 */
async function getCodeCompletion(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<string> {
  const fileContent = document.getText(); // Get the entire file content
  const linePrefix = document.getText(
    new vscode.Range(position.with(undefined, 0), position)
  );
  const languageId = document.languageId; // Get the language identifier of the document

  // Construct a strict and clear prompt for the AI model
  const prompt = `You are an AI-powered code completion tool. Your task is to provide a code completion for the given line prefix. You must return only the code block without any backticks, comments, or additional text. Ensure the generated code is strictly appropriate for the specified language and follows its syntax. Do not include any theoretical explanations or additional text.

File content:
${fileContent}

Language: ${languageId}

Complete the following code:
${linePrefix}`;

try {
    const completion = await openai.chat.completions.create({
      model: process.env.MODEL as string,
      messages: [
        {
          role: "system",
          content:
            "You are an AI code completion assistant. Your task is to analyze the provided code and suggest the most relevant completion. You must return only the code block without any backticks, comments, or additional text. Ensure the generated code is strictly appropriate for the specified language and follows its syntax. Do not include any theoretical explanations or additional text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 256,
    });
  
    let completionText = completion.choices[0]?.message?.content?.trim() || "";
  
    // Post-process the completion to ensure it contains only code
    // Avoid removing single and double quotes
    completionText = completionText.replace(/[^a-zA-Z0-9\s\{\}\(\)\[\]\;\:\.\,\+\-\*\/\%\=\>\<\!\&\|\^\~\?\\"']/g, '');
  
    // Remove any language ID that might be included
    completionText = completionText.replace(new RegExp(`\\b${languageId}\\b`, 'gi'), '');
  
    // Ensure the completion text does not include any theoretical explanations
    completionText = completionText.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '');
  
    return completionText;
  } catch (error) {
    console.error("Error fetching code completion:", error);
    vscode.window.showErrorMessage("Failed to fetch code completion. Please check your API key and connection.");
    throw error; // Re-throw the error for further handling if needed
  }
}

/**
 * Activates the VS Code extension.
 * @param context - The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Your extension "ai-powered-code-completion" is now active!');

  // Show a pop-up message when the extension is loaded
  vscode.window.showInformationMessage(
    "AI-Powered Code Completion is now active!"
  );

  // Check if the extension is loaded for the first time
  const isFirstLoad = context.globalState.get("isFirstLoad", true);
  if (isFirstLoad) {
    vscode.window.showInformationMessage(
      "Welcome to AI-Powered Code Completion!"
    );
    context.globalState.update("isFirstLoad", false); // Update the flag
  }

  // Register the inline completion provider for multiple languages
  const provider = vscode.languages.registerInlineCompletionItemProvider(
    ["typescript", "javascript", "python"], // Add other language identifiers here
    {
      async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        const completionText = await getCodeCompletion(document, position);

        if (completionText) {
          return [
            new vscode.InlineCompletionItem(
              completionText,
              new vscode.Range(position, position)
            ),
          ];
        }

        return []; // Return an empty array if no completion is available
      },
    }
  );

  // Add the provider to the extension's subscriptions
  context.subscriptions.push(provider);
}

/**
 * Deactivates the VS Code extension.
 */
export function deactivate() {}