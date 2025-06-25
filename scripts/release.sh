#!/bin/bash

# Script para facilitar o processo de release da lib star-db-query-builder

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se estamos na branch main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_error "Você deve estar na branch main para fazer um release"
    print_message "Execute: git checkout main"
    exit 1
fi

# Verificar se há mudanças não commitadas
if [ -n "$(git status --porcelain)" ]; then
    print_error "Há mudanças não commitadas no repositório"
    print_message "Faça commit ou stash das mudanças antes de continuar"
    exit 1
fi

# Atualizar branch local
print_message "Atualizando branch local..."
git pull origin main

# Executar testes
print_message "Executando testes..."
pnpm run test:ci

# Executar linting
print_message "Executando linting..."
pnpm run lint

# Build do projeto
print_message "Fazendo build do projeto..."
pnpm run build

# Atualizar CHANGELOG
print_message "Atualizando CHANGELOG..."
CURRENT_DATE=$(date +%Y-%m-%d)
sed -i.bak "s/## \[Unreleased\]/## [Unreleased]\n\n## [$NEW_VERSION] - $CURRENT_DATE/" CHANGELOG.md
rm CHANGELOG.md.bak

# Commit das mudanças do CHANGELOG
git add CHANGELOG.md
git commit -m "docs: update changelog for version $NEW_VERSION" || true

# Perguntar tipo de versão
echo ""
print_message "Escolha o tipo de versão:"
echo "1) Patch (1.1.0 → 1.1.1) - Correções de bugs"
echo "2) Minor (1.1.0 → 1.2.0) - Novas funcionalidades"
echo "3) Major (1.1.0 → 2.0.0) - Breaking changes"
echo ""
read -p "Digite o número da opção (1-3): " version_type

case $version_type in
    1)
        print_message "Criando versão patch..."
        pnpm run version:patch
        ;;
    2)
        print_message "Criando versão minor..."
        pnpm run version:minor
        ;;
    3)
        print_warning "Você está criando uma versão major. Isso pode quebrar compatibilidade!"
        read -p "Tem certeza? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            print_message "Criando versão major..."
            pnpm run version:major
        else
            print_message "Release cancelado"
            exit 0
        fi
        ;;
    *)
        print_error "Opção inválida"
        exit 1
        ;;
esac

# Obter a nova versão
NEW_VERSION=$(node -p "require('./package.json').version")
TAG_NAME="v$NEW_VERSION"

print_message "Nova versão: $NEW_VERSION"
print_message "Tag: $TAG_NAME"

# Perguntar se quer fazer push da tag
read -p "Fazer push da tag para o GitHub? (y/N): " push_tag

if [[ $push_tag =~ ^[Yy]$ ]]; then
    print_message "Fazendo push da tag..."
    git push origin --tags
    
    print_message "✅ Release iniciado!"
    print_message "O GitHub Actions irá publicar automaticamente no npm"
    print_message "Acompanhe o progresso em: https://github.com/starbem/star-db-query-builder/actions"
else
    print_message "Tag criada localmente. Execute 'git push origin --tags' quando estiver pronto"
fi

print_message "Processo concluído!" 