# 🚀 FiveM Script Template (MRI Edition)

Este é o template oficial da **MRI Qbox Team** para a criação de novos recursos de FiveM. Ele fornece uma estrutura sólida, organizada e pronta para um pipeline de CI/CD profissional.

## 🌟 Destaques do Template

- **Padrões MRI**: Configuração de `lua54`, suporte a `ox_lib` e estrutura de pastas organizada.
- **Automação Total**:
  - **Semantic Release**: Versionamento automático via commits.
  - **GitHub Actions**: Atualização automática de dependências, manutenção e automação de releases.
  - **Build Script**: Script Bash para empacotamento parametrizado pronto para produção.

## 📁 Estrutura de Pastas

- `client/`: Código fonte Lua do lado do cliente.
- `server/`: Código fonte Lua do lado do servidor.
- `shared/`: Código compartilhado entre cliente e servidor (ex: `config.lua`).
- `dist/`: Pasta gerada pelo build contendo o recurso compactado e pronto para uso.

## 🛠️ Começando

1. **Criar Repositório**: Use o botão "Use this template" no GitHub.
2. **Instalar Dependências**:
   ```bash
   # Na raiz do projeto (para ferramentas de release e automação)
   npm install
   ```

## 📦 Build para Produção

Para gerar o pacote final do recurso, use o script de build passando o nome desejado para a pasta (normalmente o nome do script):

```bash
# Formato: ./scripts/build.sh [nome_do_script]
./scripts/build.sh mri_meuscript
```

Isso organizará os arquivos em `dist/mri_meuscript` e gerará um arquivo `mri_meuscript.zip` com apenas o necessário para o servidor.

## 📝 Convenção de Commits

Obrigatório para o funcionamento do Semantic Release:
- `feat:` Novas funcionalidades.
- `fix:` Correções de bugs.
- `chore:`, `docs:`, `refactor:` Manutenção geral.

---
*Desenvolvido com excelência pela MRI Qbox Team.*