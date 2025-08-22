# 測試環境憑證

## 管理員帳號
- **使用者名稱**: testadmin
- **密碼**: testadmin
- **用途**: 開發環境測試用管理員帳號
- **權限**: 完整系統管理權限

## 注意事項
- 此帳號僅用於本地開發環境
- 生產環境請勿使用此憑證
- 請定期更新測試密碼

## API 測試範例

### 登入取得 Session
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testadmin", "password": "testadmin"}' \
  -c cookies.txt
```

### 使用 Session 存取 API
```bash
curl -X GET http://localhost:8080/api/organization/departments \
  -b cookies.txt
```

---
*最後更新: 2025-01-21*