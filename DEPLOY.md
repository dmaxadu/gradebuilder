# Deploy GradeBuilder no Render.com

Este guia explica como fazer o deploy da aplicação GradeBuilder no Render.com usando PostgreSQL e o arquivo `render.yaml` para deploy automático.

## 🎯 Arquitetura do Deploy

- **Backend**: FastAPI (Python) - Web Service
- **Frontend**: React - Static Site
- **Banco de Dados**: PostgreSQL (gratuito, 500MB) ✅
- **Persistência**: Total - dados nunca são perdidos

## Pré-requisitos

1. Conta no [Render.com](https://render.com) (gratuita)
2. Repositório Git com o código (GitHub, GitLab, ou Bitbucket)
3. Código commitado e pushado para o repositório

## Opção 1: Deploy Automático com render.yaml (Recomendado)

### Passo 1: Preparar o Repositório

Certifique-se de que todos os arquivos estão commitados:

```bash
git add .
git commit -m "Preparar aplicação para deploy no Render"
git push origin main
```

### Passo 2: Criar Blueprint no Render

1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Clique em **"New +"** → **"Blueprint"**
3. Conecte seu repositório Git
4. O Render detectará automaticamente o arquivo `render.yaml`
5. Clique em **"Apply"**

O Render criará automaticamente:
- ✅ PostgreSQL Database (`gradebuilder-db`)
- ✅ Backend Web Service (`gradebuilder-backend`)
- ✅ Frontend Static Site (`gradebuilder-frontend`)
- ✅ Conexão automática do backend com o banco de dados

### Passo 3: Configurar Variáveis de Ambiente

#### Backend (gradebuilder-backend)

Após a criação, acesse o serviço backend e configure:

1. Vá em **Environment** → **Environment Variables**
2. Configure apenas a seguinte variável (as outras já estão automáticas):

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `ALLOWED_ORIGINS` | `https://gradebuilder-frontend.onrender.com` | URL do frontend (ajuste conforme necessário) |

**Variáveis automáticas** (já configuradas pelo render.yaml):
- ✅ `JWT_SECRET_KEY` - Gerado automaticamente
- ✅ `DATABASE_URL` - Conectado automaticamente ao PostgreSQL

**IMPORTANTE**: Substitua `gradebuilder-frontend` pela URL real do seu frontend após o deploy.

#### Frontend (gradebuilder-frontend)

1. Vá em **Environment** → **Environment Variables**
2. Configure:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `REACT_APP_API_URL` | `https://gradebuilder-backend.onrender.com` | URL do backend (ajuste conforme necessário) |

**IMPORTANTE**: Substitua `gradebuilder-backend` pela URL real do seu backend após o deploy.

### Passo 4: Aguardar o Deploy

1. O Render fará o deploy automaticamente após aplicar o blueprint
2. Aguarde a conclusão do build:
   - **PostgreSQL**: ~1-2 minutos
   - **Backend**: ~2-3 minutos
   - **Frontend**: ~3-4 minutos
3. Verifique se todos os serviços estão com status "Live" (verde)

### Passo 5: Inicializar o Banco de Dados

O banco de dados PostgreSQL será inicializado automaticamente na primeira requisição à API. Para verificar:

1. Acesse `https://gradebuilder-backend.onrender.com/docs`
2. Se a página carregar, o banco foi inicializado com sucesso!

---

## Opção 2: Deploy Manual (Alternativa)

### 1. Criar PostgreSQL Database

1. No [Render Dashboard](https://dashboard.render.com), clique em **"New +"** → **"PostgreSQL"**
2. Configure:
   - **Name**: `gradebuilder-db`
   - **Database**: `gradebuilder`
   - **User**: `gradebuilder`
   - **Plan**: `Free`
3. Clique em **"Create Database"**
4. Aguarde a criação (~1-2 minutos)
5. Copie a **Internal Database URL** (você vai precisar)

### 2. Criar Backend Web Service

1. No Render Dashboard, clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório
3. Configure:
   - **Name**: `gradebuilder-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`

4. Configure as variáveis de ambiente:
   - `ALLOWED_ORIGINS`: (URL do frontend - configurar depois)
   - `JWT_SECRET_KEY`: (gerar valor aleatório)
   - `DATABASE_URL`: (colar a Internal Database URL copiada)

5. Clique em **"Create Web Service"**

### 3. Criar Frontend Static Site

1. No Render Dashboard, clique em **"New +"** → **"Static Site"**
2. Conecte seu repositório
3. Configure:
   - **Name**: `gradebuilder-frontend`
   - **Root Directory**: `front`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`

4. Configure a variável de ambiente:
   - `REACT_APP_API_URL`: (URL do backend criado no passo anterior)

5. Clique em **"Create Static Site"**

---

## Atualizar CORS no Backend

Após obter a URL do frontend, você precisa atualizar a variável `ALLOWED_ORIGINS` no backend:

1. Acesse o serviço backend no Render
2. Vá em **Environment** → **Environment Variables**
3. Edite `ALLOWED_ORIGINS` para incluir a URL do frontend:
   ```
   https://gradebuilder-frontend.onrender.com
   ```
4. Salve e aguarde o redeploy automático

---

## Verificar o Deploy

### Backend
- Acesse: `https://gradebuilder-backend.onrender.com/docs`
- Você deve ver a documentação Swagger da API

### Frontend
- Acesse: `https://gradebuilder-frontend.onrender.com`
- Você deve ver a página de login do GradeBuilder

---

## Troubleshooting

### Erro de CORS no Frontend

**Sintoma**: Erros de CORS no console do browser

**Solução**:
1. Verifique se `ALLOWED_ORIGINS` no backend contém a URL correta do frontend
2. Certifique-se de incluir `https://` e não deixar `/` no final
3. Aguarde o redeploy após alterar variáveis de ambiente

### Erro 404 ao recarregar página no Frontend

**Sintoma**: Navegação funciona, mas ao recarregar a página dá erro 404

**Solução**: O `render.yaml` já inclui a configuração de rotas necessária. Se fez deploy manual, adicione em **Redirects/Rewrites**:
- Source: `/*`
- Destination: `/index.html`
- Action: `Rewrite`

### Backend não inicia

**Sintoma**: Erro ao iniciar o serviço

**Solução**:
1. Verifique os logs em **Logs** no painel do Render
2. Certifique-se de que `requirements.txt` está correto
3. Verifique se todas as variáveis de ambiente estão configuradas

### Banco de dados não persiste / Erros de conexão

**Sintoma**: Dados são perdidos, erro de conexão com banco

**Solução**:
1. Verifique se o PostgreSQL está criado e com status "Available"
2. No serviço backend, vá em **Environment** e verifique se `DATABASE_URL` está configurada
3. Se usar `render.yaml`, o Render conecta automaticamente
4. Aguarde 1-2 minutos após deploy para o banco inicializar

### Erro psycopg2 no build

**Sintoma**: `Error: pg_config executable not found`

**Solução**: Isso não deve acontecer, pois usamos `psycopg2-binary`. Se ocorrer:
1. Verifique se `psycopg2-binary` está em `requirements.txt`
2. Tente fazer redeploy manual

---

## Custos

### Plano Free (Usando PostgreSQL) ✅ RECOMENDADO
- ✅ Backend gratuito
- ✅ Frontend gratuito
- ✅ PostgreSQL gratuito (500MB, 90 dias de retenção)
- ✅ Persistência TOTAL de dados
- ⚠️ Serviços dormem após 15min de inatividade
- ⚠️ Tempo de cold start: ~30 segundos
- ⚠️ 750 horas/mês de uso

### Plano Pago ($7/mês por serviço)
- ✅ Sem cold start
- ✅ Mais recursos computacionais
- ✅ Horas ilimitadas
- ✅ Suporte prioritário

**Custo Total Plano Free**: $0/mês 🎉

---

## URLs Finais

Após o deploy completo:

- **Frontend**: https://gradebuilder-frontend.onrender.com
- **Backend API**: https://gradebuilder-backend.onrender.com
- **API Docs**: https://gradebuilder-backend.onrender.com/docs

---

## Próximos Passos

1. ✅ Testar criação de conta
2. ✅ Testar login
3. ✅ Testar drag and drop de disciplinas
4. ✅ Testar salvamento automático
5. ✅ Testar otimização de layout
6. ✅ Verificar persistência dos dados
7. 🔧 Configurar domínio customizado (opcional)
8. 🔧 Configurar HTTPS customizado (opcional)
9. 🔧 Adicionar monitoramento (opcional)

---

## Manutenção

### Atualizar a aplicação

1. Faça commit das mudanças:
   ```bash
   git add .
   git commit -m "Descrição das mudanças"
   git push origin main
   ```

2. O Render fará redeploy automático

### Ver logs

- Acesse cada serviço no Render Dashboard
- Clique em **"Logs"**
- Use os logs para debugging

### Fazer rollback

1. Acesse o serviço no Render
2. Vá em **"Events"**
3. Selecione um deploy anterior
4. Clique em **"Rollback to this version"**

---

## Suporte

Para problemas com o Render:
- [Documentação Oficial](https://render.com/docs)
- [Render Community](https://community.render.com)
- [Status do Render](https://status.render.com)

---

**Boa sorte com o deploy! 🚀**
