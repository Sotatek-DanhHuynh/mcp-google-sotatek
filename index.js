#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { google } = require('googleapis');

const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH;

if (!CREDENTIALS_PATH) {
  console.error('Missing GOOGLE_CREDENTIALS_PATH (path to service account JSON key)');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents',
  ],
});

const sheets = google.sheets({ version: 'v4', auth });
const docs = google.docs({ version: 'v1', auth });

const server = new Server(
  { name: 'google-server', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Google Sheets ──────────────────────────────────────────
    {
      name: 'read_sheet',
      description: 'Đọc dữ liệu từ một range trong Google Sheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'ID của spreadsheet (lấy từ URL)' },
          range: { type: 'string', description: 'VD: Sheet1!A1:D100' },
        },
        required: ['spreadsheetId', 'range'],
      },
    },
    {
      name: 'write_sheet',
      description: 'Ghi/cập nhật dữ liệu vào một range trong Google Sheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'ID của spreadsheet' },
          range: { type: 'string', description: 'VD: Sheet1!A1' },
          values: {
            type: 'array',
            description: 'Mảng 2 chiều, mỗi phần tử là 1 row. VD: [["Tên", "Tuổi"], ["An", 25]]',
            items: { type: 'array', items: {} },
          },
        },
        required: ['spreadsheetId', 'range', 'values'],
      },
    },
    {
      name: 'append_sheet',
      description: 'Thêm rows mới vào cuối bảng trong Google Sheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'ID của spreadsheet' },
          range: { type: 'string', description: 'VD: Sheet1!A1 (Google tự tìm dòng cuối)' },
          values: {
            type: 'array',
            description: 'Mảng 2 chiều rows cần thêm',
            items: { type: 'array', items: {} },
          },
        },
        required: ['spreadsheetId', 'range', 'values'],
      },
    },
    {
      name: 'clear_sheet',
      description: 'Xóa dữ liệu trong một range của Google Sheet (giữ nguyên format)',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'ID của spreadsheet' },
          range: { type: 'string', description: 'VD: Sheet1!A2:Z1000' },
        },
        required: ['spreadsheetId', 'range'],
      },
    },
    {
      name: 'get_sheet_info',
      description: 'Lấy danh sách các sheet (tab) trong một spreadsheet',
      inputSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'ID của spreadsheet' },
        },
        required: ['spreadsheetId'],
      },
    },
    // ── Google Docs ────────────────────────────────────────────
    {
      name: 'read_doc',
      description: 'Đọc nội dung toàn bộ một Google Doc dạng plain text',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'ID của document (lấy từ URL)' },
        },
        required: ['documentId'],
      },
    },
    {
      name: 'append_doc',
      description: 'Chèn text vào cuối một Google Doc',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'ID của document' },
          text: { type: 'string', description: 'Nội dung cần thêm vào cuối doc' },
        },
        required: ['documentId', 'text'],
      },
    },
    {
      name: 'replace_doc_text',
      description: 'Tìm và thay thế text trong Google Doc',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string', description: 'ID của document' },
          find: { type: 'string', description: 'Đoạn text cần tìm' },
          replace: { type: 'string', description: 'Đoạn text thay thế' },
          matchCase: { type: 'boolean', description: 'Phân biệt hoa thường (default: false)', default: false },
        },
        required: ['documentId', 'find', 'replace'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ── Sheets ──────────────────────────────────────────────────
    if (name === 'read_sheet') {
      const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ range: data.range, values: data.values ?? [] }, null, 2),
        }],
      };
    }

    if (name === 'write_sheet') {
      const { data } = await sheets.spreadsheets.values.update({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: args.values },
      });
      return {
        content: [{ type: 'text', text: `Đã ghi ${data.updatedCells} cells vào ${data.updatedRange}.` }],
      };
    }

    if (name === 'append_sheet') {
      const { data } = await sheets.spreadsheets.values.append({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: args.values },
      });
      return {
        content: [{ type: 'text', text: `Đã thêm rows vào ${data.updates?.updatedRange}.` }],
      };
    }

    if (name === 'clear_sheet') {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: args.spreadsheetId,
        range: args.range,
      });
      return {
        content: [{ type: 'text', text: `Đã xóa dữ liệu trong range ${args.range}.` }],
      };
    }

    if (name === 'get_sheet_info') {
      const { data } = await sheets.spreadsheets.get({
        spreadsheetId: args.spreadsheetId,
        fields: 'properties.title,sheets.properties',
      });
      const sheetList = data.sheets.map((s) => ({
        id: s.properties.sheetId,
        title: s.properties.title,
        rowCount: s.properties.gridProperties?.rowCount,
        columnCount: s.properties.gridProperties?.columnCount,
      }));
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ title: data.properties.title, sheets: sheetList }, null, 2),
        }],
      };
    }

    // ── Docs ────────────────────────────────────────────────────
    if (name === 'read_doc') {
      const { data } = await docs.documents.get({ documentId: args.documentId });
      const text = extractDocText(data.body.content);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ title: data.title, text }, null, 2),
        }],
      };
    }

    if (name === 'append_doc') {
      const { data: docData } = await docs.documents.get({
        documentId: args.documentId,
        fields: 'body.content',
      });
      const endIndex = getDocEndIndex(docData.body.content);
      await docs.documents.batchUpdate({
        documentId: args.documentId,
        requestBody: {
          requests: [{
            insertText: {
              location: { index: endIndex },
              text: '\n' + args.text,
            },
          }],
        },
      });
      return {
        content: [{ type: 'text', text: `Đã thêm text vào cuối document.` }],
      };
    }

    if (name === 'replace_doc_text') {
      await docs.documents.batchUpdate({
        documentId: args.documentId,
        requestBody: {
          requests: [{
            replaceAllText: {
              containsText: {
                text: args.find,
                matchCase: args.matchCase ?? false,
              },
              replaceText: args.replace,
            },
          }],
        },
      });
      return {
        content: [{ type: 'text', text: `Đã thay thế "${args.find}" → "${args.replace}".` }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return {
      content: [{ type: 'text', text: `Lỗi: ${msg}` }],
      isError: true,
    };
  }
});

// ── Helpers ─────────────────────────────────────────────────────
function extractDocText(content) {
  if (!content) return '';
  return content.map((el) => {
    if (el.paragraph) {
      return el.paragraph.elements
        .map((e) => e.textRun?.content ?? '')
        .join('');
    }
    if (el.table) {
      return el.table.tableRows
        .map((row) =>
          row.tableCells.map((cell) => extractDocText(cell.content)).join('\t'),
        )
        .join('\n');
    }
    return '';
  }).join('');
}

function getDocEndIndex(content) {
  if (!content || content.length === 0) return 1;
  const last = content[content.length - 1];
  return (last.endIndex ?? 1) - 1;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
