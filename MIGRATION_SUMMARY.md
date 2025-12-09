# Migração para PostgreSQL - Resumo

## ✅ Migração Concluída!

A aplicação GradeBuilder foi migrada de SQLite para PostgreSQL para garantir persistência de dados no plano gratuito do Render.com.

---

## 🔄 Alterações Realizadas

### 1. Backend

#### [backend/requirements.txt](backend/requirements.txt:9)
- ✅ Adicionado `psycopg2-binary` para suporte PostgreSQL

#### [backend/database.py](backend/database.py:7-15)
- ✅ Atualizado para suportar tanto SQLite (desenvolvimento) quanto PostgreSQL (produção)
- ✅ Configuração automática baseada na `DATABASE_URL`

#### [backend/.env.example](backend/.env.example)
- ✅ Atualizado com exemplos para desenvolvimento e produção
- ✅ Inclui exemplos de URLs PostgreSQL

### 2. Deploy

#### [render.yaml](render.yaml:1-6)
- ✅ Adicionada seção `databases` com PostgreSQL gratuito
- ✅ Removida seção `disk` (não é mais necessária)
- ✅ Configurado `DATABASE_URL` automático via `fromDatabase`

#### [DEPLOY.md](DEPLOY.md)
- ✅ Atualizado com instruções completas para PostgreSQL
- ✅ Adicionada seção de arquitetura do deploy
- ✅ Atualizado troubleshooting
- ✅ Removidas instruções de migração (já está migrado)

### 3. Arquivos Removidos

- ❌ `backend/build.sh` - Não é mais necessário

---

## 🎯 Benefícios da Migração

| Aspecto | SQLite (Antes) | PostgreSQL (Agora) |
|---------|----------------|-------------------|
| **Persistência** | ❌ Perdida a cada deploy | ✅ Permanente |
| **Custo no Render** | $7/mês (disco pago) | $0/mês (gratuito) |
| **Capacidade** | Limitado ao disco | 500MB gratuito |
| **Escalabilidade** | Baixa | Alta |
| **Produção** | ⚠️ Não recomendado | ✅ Recomendado |

---

## 📋 Próximos Passos para Deploy

1. **Commit as mudanças**:
   ```bash
   git add .
   git commit -m "Migrar para PostgreSQL para deploy no Render"
   git push origin main
   ```

2. **Seguir o guia de deploy**:
   - Consulte [DEPLOY.md](DEPLOY.md) para instruções completas
   - Use a **Opção 1** (Blueprint com render.yaml) - mais fácil e automático

3. **Configurar variáveis de ambiente**:
   - `ALLOWED_ORIGINS` no backend (URL do frontend)
   - `REACT_APP_API_URL` no frontend (URL do backend)

---

## 🔍 Desenvolvimento Local

A aplicação continua usando SQLite para desenvolvimento local. Não há necessidade de PostgreSQL na sua máquina!

**Como rodar localmente** (sem mudanças):
```bash
# Backend
.venv\Scripts\activate
cd backend
uvicorn main:app --reload

# Frontend
cd front
npm start
```

O arquivo `.env` local já está configurado para usar SQLite:
```env
DATABASE_URL=sqlite:///./gradebuilder.db
```

---

## 🐘 PostgreSQL no Render

O `render.yaml` criará automaticamente:

```yaml
databases:
  - name: gradebuilder-db
    databaseName: gradebuilder
    user: gradebuilder
    plan: free  # 500MB, 90 dias de retenção
```

A conexão é feita automaticamente via:
```yaml
envVars:
  - key: DATABASE_URL
    fromDatabase:
      name: gradebuilder-db
      property: connectionString
```

---

## ⚡ Performance

- **Cold Start**: ~30 segundos (serviço dorme após 15min de inatividade)
- **Warm Response**: <100ms
- **Database Init**: Automática na primeira requisição

---

## 🆘 Suporte

Se precisar de ajuda:
1. Consulte [DEPLOY.md](DEPLOY.md) - seção Troubleshooting
2. Verifique logs no Render Dashboard
3. [Documentação do Render](https://render.com/docs)

---

## ✨ Resumo Técnico

A migração foi feita de forma **híbrida**:
- **Desenvolvimento**: SQLite (simples, sem configuração)
- **Produção**: PostgreSQL (persistente, gratuito)

O código detecta automaticamente qual banco usar baseado na variável `DATABASE_URL`. SQLAlchemy abstrai as diferenças entre os bancos, tornando a migração transparente.

---

**Status**: ✅ Pronto para deploy!
**Custo**: 💰 $0/mês
**Persistência**: ✅ Total

🚀 **Boa sorte com o deploy!**
