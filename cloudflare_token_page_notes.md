# Cloudflare API Token Create Page Notes

หน้า Cloudflare Dashboard เปิดอยู่ที่ account `723361e78c5f649385c15bd28613a02d` ในหน้า `Account API tokens > Create a token` และผู้ใช้ล็อกอินอยู่แล้วด้วยบัญชี `Kannaphong.k@gmail.com's Account`.

สถานะหน้าเห็นฟอร์มสร้าง token แบบ Custom โดยมีช่อง `Token name` และส่วน `Permission policies` พร้อม scope ค่าเริ่มต้นเป็น `Entire Account`. ต้องตั้งค่า token ให้มีสิทธิ์สำหรับ deploy Cloudflare Pages ผ่าน Wrangler ได้แก่ Cloudflare Pages edit และ account/user read ที่จำเป็นต่อ CLI.

ขั้นตอนถัดไปคือเลือก permission groups ที่เหมาะสมในหน้า UI แล้วขอ confirmation ก่อนสร้าง token จริง หากปุ่มสุดท้ายเป็นการสร้าง/ออก token ลับใหม่.

## Developer Platform permissions visible

หลังขยาย `Developer Platform` เห็น permission หลายรายการ เช่น Agent Memory, Browser Run, CF Agents, Cloudchamber, D1, Hyperdrive, MCP Portals, **Pages**, และ Pipelines. รายการ **Pages** แสดงคำอธิบาย `Grants read access to Cloudflare Pages` และ dropdown/action ปัจจุบันเป็น `Read`; ต้องเปลี่ยนเป็น **Edit** เพื่อให้ Wrangler deploy Cloudflare Pages ได้.

## Token form status before submission

ตั้งชื่อ token เป็น `ncr-watchdog-pages-deploy` แล้ว และเลือก permission ในกลุ่ม `Developer Platform` สำหรับรายการ **Pages** เป็น **Edit** ผ่าน DOM โดยพบ row text `Pages Grants read access to Cloudflare Pages Read Edit` และคลิก label `Edit` แล้ว. Scope ของ policy ยังเป็น `Entire Account` ตามค่าเริ่มต้นของฟอร์ม.


## Token permission verification update

The newly created token verifies successfully, but direct Cloudflare Pages API access still fails with `Authentication error [code: 10000]` on `GET /accounts/723361e78c5f649385c15bd28613a02d/pages/projects`. This indicates the generated token did not include the correct **Account → Cloudflare Pages** permission, even though the dashboard summary displayed a Pages Write policy. The next step is to create a replacement token using the explicit Cloudflare Pages account permission and, if available, the recommended Edit Cloudflare Workers template or additional account/user read permissions required by Wrangler.


## 2026-05-27 03:24 ICT - Replacement token form update

After the direct Wrangler upload still returned `Authentication error [code: 10000]`, I inspected the active Cloudflare API token creation form again. The visible **Pages** permission row showed unchecked controls initially, so I selected the **Edit** checkbox directly on the Pages row. The row text changed to **"Grants write access to Cloudflare Pages"**, confirming that the replacement token form now has Cloudflare Pages write/edit permission selected.

No token secret value is stored in this note.


## Wrangler OAuth status update

User confirmed proceeding with Wrangler OAuth. The Cloudflare consent page loaded under account `Kannaphong.k@gmail.com's Account`. The account row was selected, and `Review permissions` was clicked successfully. The page moved to the permissions review/loading state for Wrangler authorization. No credential values were recorded here.


## Wrangler OAuth callback issue

After clicking `Authorize`, Cloudflare redirected the browser to localhost, but the page showed `ERR_CONNECTION_REFUSED`. The terminal prompt was no longer running the Wrangler OAuth callback server, so the browser authorization could not complete in that attempt. No token or secret values were recorded.


## OAuth attempt update

The Cloudflare consent page loaded for `kannaphong.k@gmail.com`. The selected account was `Kannaphong.k@gmail.com's Account`. After selecting the account, the permissions review page showed 24 total permissions across Account & Billing, Developer Platform, App Security, Cache & Performance, and DNS & Zones. The user confirmed authorization, and the Authorize button was clicked. The browser redirected to a localhost callback URL, but the first attempt reached the callback after Wrangler had already timed out; a subsequent new OAuth state was started.
