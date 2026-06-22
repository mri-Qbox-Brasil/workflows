# template-fivem — Workflow Library

Repositório central de workflows reutilizáveis (callables) para os scripts FiveM da MRI Qbox Brasil.

Também publica o pacote npm `@mri-qbox-brasil/workflows`, que contém os scripts de build e release usados pelos callables.

---

## Workflows disponíveis

| Workflow | O que faz |
|---|---|
| `callable-release.yml` | Build do recurso + semantic release automatizado |
| `callable-update-actions.yml` | Atualização de versões das GitHub Actions |
| `callable-repo-dispatch.yml` | Notificação ao repo de documentação |
| `callable-template-sync.yml` | Sincronização com o `script-template` |

## Como usar

Nos repositórios de script, delegue para os callables:

```yaml
jobs:
  release:
    uses: mri-Qbox-Brasil/template-fivem/.github/workflows/callable-release.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

Consulte `.github/SETUP.md` para a lista completa de inputs, secrets e checklist de configuração.

## Template de script

Para criar um novo script FiveM, use o repositório `mri-Qbox-Brasil/script-template`, que vem pré-configurado com todos os workflows delegando para os callables deste repo.
