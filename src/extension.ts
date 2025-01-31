import * as vscode from "vscode";
import OpenAI from "openai";
import { config } from "dotenv";
config({ path: ".env" });

// Initialize the OpenAI client with the NVIDIA API endpoint
const openai = new OpenAI({
  apiKey: process.env.SECRET_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1", // NVIDIA API endpoint
});

async function getCodeCompletion(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<string> {
  const fileContent = document.getText(); // Get the entire file content
  const linePrefix = document.getText(
    new vscode.Range(position.with(undefined, 0), position)
  );

  // Use the file content or specific context (e.g., comments) as the prompt
  const prompt = `File content:\n${fileContent}\n\nComplete the following code. Return only the code block without any explanations or backticks:\n${linePrefix}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "qwen/qwen2.5-coder-32b-instruct",
      messages: [
        {
          role: "system",
          content:
            "You are an coding completion ai like github copilot and tabning your task is to code the code by analyzing the user prompt.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 1024,
    });

    return completion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Error fetching code completion:", error);
    return "";
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Your extension "ai-powered-code-completion" is now active!');

  // Check if the extension is loaded for the first time
  const isFirstLoad = context.globalState.get("isFirstLoad", true);
  if (isFirstLoad) {
    vscode.window.showInformationMessage(
      "Welcome to AI-Powered Code Completion! Start typing to get suggestions."
    );
    context.globalState.update("isFirstLoad", false); // Update the flag
  }

  const provider = vscode.languages.registerInlineCompletionItemProvider(
    "typescript",
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

        return [];
      },
    }
  );

  context.subscriptions.push(provider);
}

export function deactivate() {}
