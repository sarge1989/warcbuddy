// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type {NextApiRequest, NextApiResponse} from 'next'
import BeautifulSoup from 'beautiful-soup-js'; 
import { WARCParser, WARCRecord } from 'warcio';
import { Readable } from 'stream';
import formidable from 'formidable';
import fs from 'fs';
import prompt from '../../prompts/prompts.json'
import OpenAI from 'openai';

const openai = new OpenAI();

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const file = await parseForm(req);
    if (!file) {
      res.status(400).json({ error: "File not found in the request" });
      return;
    }

    const stream = fs.createReadStream(file.filepath);
    
    const content = await extractAndConcatenate(stream);
    const result = await getResult(content);
    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

function parseForm(req: NextApiRequest): Promise<formidable.File | null> {
  return new Promise((resolve, reject) => {
    const form = formidable({});
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      if (!files.file || files.file.length !== 1) {
        resolve(null);
        return;
      }
      const file = files.file[0] as formidable.File;
      resolve(file);
    });
  });
}

async function getResult(extract: string): Promise<object> {
  const systemPrompt = prompt.system
  const examples = prompt.examples
  const messages: OpenAI.ChatCompletionMessageParam[] = [{role: 'system', content: systemPrompt}];
  for (const example of examples) {
    messages.push({role: 'user', content: example.user});
    messages.push({role: 'assistant', content: example.assistant});
  }
  messages.push({role: 'system', content: systemPrompt})
  messages.push({role: 'user', content: extract});
  const chatCompletion = await openai.chat.completions.create({
    messages: messages,
    model: 'gpt-4-1106-preview',
    temperature: 0,
    seed: 11,
    response_format: { "type": "json_object" }
  });
  const jsonString = chatCompletion.choices?.[0].message.content
  if (jsonString) {
    try {
      const outputs = JSON.parse(jsonString)
      return outputs
    }
    catch (e) {
      console.log(e)
      throw(e)
    }
  }
  else {
    throw(Error("openAI did not return JSON"))
  }
}

async function extractAndConcatenate(stream: Readable): Promise<string> {
  let concatenatedContent = "";
  const processedUris = new Set<string>();

  const parser = new WARCParser(stream);
    for await (const record of parser) {
      if (record.warcType === 'response') {
        const uri = record.warcHeaders.headers.get('WARC-Target-URI');
        if (uri && !processedUris.has(uri) && !isNonContentUri(uri)) {
          const { title, content } = await processResponse(record);
          if (content) {
            concatenatedContent += `\n\n--- Page: ${uri} ---\nTitle: ${title}\n\nContent:${content}`;
            processedUris.add(uri);
          }
        }
      }
    }
  return concatenatedContent;
}

async function processResponse(record: WARCRecord): Promise<{ title: string; content: string }> {
  const contentType = record.httpHeaders?.headers.get('Content-Type');
  if (contentType === null) {
    return { title: "", content: "" };
  }
  if (contentType && contentType.includes('text/html')) {
      const content = await record.contentText();
      const soup = new BeautifulSoup(content);
      // Find all script tags
      const scriptTags = soup.findAll({ name: 'script' });

      // Find all style tags
      const styleTags = soup.findAll({ name: 'style' });

      // Remove all script tags using soup.extract
      scriptTags.forEach((tag) => tag.extract());

      // Remove all style tags using soup.extract
      styleTags.forEach((tag) => tag.extract());

      const cleanedContent = cleanContent(soup.getText());
      const title = soup.find({name : 'title'}) ? soup.find({name : 'title'}).getText() : "No Title";
      if (isNotMeaningfulContent(cleanedContent) || isNotMeaningfulTitle(title)) {
        return { title: "", content: "" };
      } else {
        
        return { title, content: cleanedContent };
      }
  }
  else {
      return { title: "", content: "" };
  }
}

function cleanContent(content: string): string {
  return content.split('\n').map(line => line.trim()).filter(line => line).join('\n');
}

function isNotMeaningfulContent(content: string): boolean {
  const nonMeaningfulIndicators = ["404", "401,", "403", "lorem", "blockquote", "class=", "href", "not found", "can't be found", "nothing was found"];
  return nonMeaningfulIndicators.some(indicator => content.toLowerCase().includes(indicator));
}

function isNotMeaningfulTitle(title: string): boolean {
  const nonMeaningfulIndicators = ["index of", "404", "401", "400", "403", "304", "301"];
  return nonMeaningfulIndicators.some(indicator => title.toLowerCase().includes(indicator));
}

function isNonContentUri(uri: string): boolean {
  const nonContentIndicators = ["admin", "login", "error", "404", "401", "403", "ajax", "index"];
  const isFile = uri.split('/').pop()?.includes('.') || false; // Check if the last segment contains a dot, suggesting it's a file.
  return nonContentIndicators.some(indicator => uri.includes(indicator)) || isFile;
}
