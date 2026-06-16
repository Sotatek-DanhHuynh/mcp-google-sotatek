# MCP Google Sotatek

MCP server kết nối Claude với **Google Sheets** và **Google Docs**, dùng chung cho team qua 1 Service Account.

## Cài đặt (Dev)

Yêu cầu: **Node.js >= 18**, Claude Desktop hoặc Claude Code CLI.

```powershell
irm https://raw.githubusercontent.com/Sotatek-DanhHuynh/mcp-google-sotatek/master/setup.ps1 | iex
```

Script sẽ tự động:
1. Kiểm tra Node.js
2. Download `index.js` + `package.json` về `%APPDATA%\mcp-google-sotatek`
3. Cài dependencies (`npm install`)
4. Tạo file rỗng `%LOCALAPPDATA%\mcp-google-sotatek\credentials.json`, mở Notepad để bạn paste nội dung JSON key (JSON key là chìa khóa để sử dụng MCP)
5. Validate JSON, ghi config vào Claude Desktop (`claude_desktop_config.json`) và Claude Code CLI (nếu có)

Sau khi setup xong, **restart Claude Desktop/CLI** để load MCP.

## Trước khi dùng — Share quyền truy cập

Mỗi Google Sheet/Doc cần dùng phải được **Share** với email của Service Account (Editor):

```
mcp-google-bot@bctk-sotatek.iam.gserviceaccount.com
```

Lấy `spreadsheetId` / `documentId` từ URL:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
https://docs.google.com/document/d/DOCUMENT_ID/edit
```

## Tools

### Google Sheets

| Tool | Mô tả |
|---|---|
| `read_sheet` | Đọc dữ liệu từ một range (VD: `Sheet1!A1:D100`) |
| `write_sheet` | Ghi/cập nhật dữ liệu vào một range |
| `append_sheet` | Thêm rows mới vào cuối bảng |
| `clear_sheet` | Xóa dữ liệu trong một range (giữ format) |
| `get_sheet_info` | Lấy danh sách các sheet (tab) trong spreadsheet |

### Google Docs

| Tool | Mô tả |
|---|---|
| `read_doc` | Đọc toàn bộ nội dung document (plain text) |
| `append_doc` | Chèn text vào cuối document |
| `replace_doc_text` | Tìm và thay thế text trong document |

## Thiết lập Service Account (admin làm 1 lần)

1. Vào [console.cloud.google.com](https://console.cloud.google.com) → tạo project trong org `sotatek.com`
2. **APIs & Services → Library** → Enable **Google Sheets API** và **Google Docs API**
3. **IAM & Admin → Service Accounts → Create Service Account**
4. Vào service account vừa tạo → tab **Keys** → **Add Key** → **Create new key** → chọn **JSON**
5. Gửi nội dung file JSON cho member qua kênh nội bộ an toàn (không qua Git, không public)
6. Share từng Google Sheet/Doc cần dùng với email service account, quyền **Editor**

## Bảo mật

- File `credentials.json` là **chìa khóa truy cập** — không commit lên Git (đã có trong `.gitignore`), không gửi qua kênh công khai
- Chỉ share những Sheet/Doc cần thiết với service account, không share toàn bộ Drive
- Nếu key bị lộ: vào Cloud Console → Service Account → Keys → Delete key, tạo key mới, gửi lại cho team

## Chi phí

Miễn phí — Google Sheets API và Docs API có free quota 300 requests/phút/project, không cần gắn billing account.
