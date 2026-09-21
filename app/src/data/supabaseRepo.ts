import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKET_FOTOS, caminhoMiniatura } from '../domain/fotos.ts'
import type { Cardapio, ConfigLoja, GrupoOpcao, Produto } from '../domain/tipos.ts'

// Lê o cardápio do Supabase com a chave PÚBLICA (anon). Quem decide o que o público enxerga é o
// RLS do banco (supabase/migrations/*_rls.sql): só categorias/produtos/opções ativos.

export type LinhaOpcao = {
  /** Só vem preenchido quando lemos com a service role (o RLS já esconde os inativos do público). */
  ativo?: boolean
  id: string
  nome: string
  preco_adicional_centavos: number
  produto_id: string | null
  disponivel: boolean
  ordem: number
}

export type LinhaGrupo = {
  id: string
  nome: string
  min_escolhas: number
  max_escolhas: number
  ordem: number
  opcoes: LinhaOpcao[] | null
}

export type LinhaProduto = {
  ativo?: boolean
  id: string
  categoria_id: string
  nome: string
  descricao: string | null
  preco_centavos: number
  preco_original_centavos: number | null
  foto_path: string | null
  eh_combo: boolean
  disponivel: boolean
  ordem: number
  grupos_opcao: LinhaGrupo[] | null
}

export type LinhaCategoria = {
  ativo?: boolean
  id: string
  nome: string
  descricao: string | null
  ordem: number
}

export type LinhaLoja = {
  nome: string
  fuso_horario: string
  modo: ConfigLoja['modo']
  latitude: number | null
  longitude: number | null
  frete_base_centavos: number
  frete_por_km_centavos: number
  raio_maximo_km: number | string
  pedido_minimo_centavos: number
  tempo_preparo_min: number
}

export type LinhaHorario = { dia_semana: number; abre: string; fecha: string }

export type DadosDoBanco = {
  categorias: LinhaCategoria[]
  produtos: LinhaProduto[]
  loja: LinhaLoja
  horarios: LinhaHorario[]
}

const porOrdem = <T extends { ordem: number; nome: string }>(a: T, b: T) =>
  a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')

/** Converte as linhas do banco (snake_case) no `Cardapio` usado pelo app. Função pura, testada. */
export function montarCardapio(
  d: DadosDoBanco,
  /** Caminho no Storage → endereço público. Sem isto, o cardápio usa o marcador no lugar da foto. */
  urlFoto: (caminho: string) => string = () => '',
): Cardapio {
  // A service role (função de pedidos) ignora o RLS, então filtramos os inativos aqui também.
  const categorias = [...d.categorias]
    .filter((c) => c.ativo !== false)
    .sort(porOrdem)
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      descricao: c.descricao ?? undefined,
      ordem: c.ordem,
    }))
  const idsCategorias = new Set(categorias.map((c) => c.id))

  const produtos: Produto[] = [...d.produtos]
    // Produto de categoria inativa (que o público não enxerga) não deve aparecer sem seção.
    .filter((p) => p.ativo !== false && idsCategorias.has(p.categoria_id))
    .sort(porOrdem)
    .map((p) => ({
      id: p.id,
      categoriaId: p.categoria_id,
      nome: p.nome,
      descricao: p.descricao ?? undefined,
      precoCentavos: p.preco_centavos,
      precoOriginalCentavos: p.preco_original_centavos ?? undefined,
      fotoUrl: (p.foto_path && urlFoto(p.foto_path)) || undefined,
      fotoMiniaturaUrl: (p.foto_path && urlFoto(caminhoMiniatura(p.foto_path))) || undefined,
      ehCombo: p.eh_combo,
      disponivel: p.disponivel,
      grupos: [...(p.grupos_opcao ?? [])].sort(porOrdem).map((g): GrupoOpcao => ({
        id: g.id,
        nome: g.nome,
        minEscolhas: g.min_escolhas,
        maxEscolhas: g.max_escolhas,
        opcoes: [...(g.opcoes ?? [])]
          .filter((o) => o.ativo !== false)
          .sort(porOrdem)
          .map((o) => ({
            id: o.id,
            nome: o.nome,
            precoAdicionalCentavos: o.preco_adicional_centavos,
            produtoId: o.produto_id ?? undefined,
            disponivel: o.disponivel,
          })),
      })),
    }))

  const l = d.loja
  return {
    categorias,
    produtos,
    loja: {
      nome: l.nome,
      fusoHorario: l.fuso_horario,
      modo: l.modo,
      pedidoMinimoCentavos: l.pedido_minimo_centavos,
      tempoPreparoMin: l.tempo_preparo_min,
      horarios: d.horarios.map((h) => ({ diaSemana: h.dia_semana, abre: h.abre, fecha: h.fecha })),
      entrega: {
        // Hoje o banco guarda a regra "por km"; outras regras dependem da decisão P4.
        regra: {
          tipo: 'por_km',
          baseCentavos: l.frete_base_centavos,
          porKmCentavos: l.frete_por_km_centavos,
        },
        raioMaximoKm: Number(l.raio_maximo_km),
        origem:
          l.latitude !== null && l.longitude !== null
            ? { latitude: l.latitude, longitude: l.longitude }
            : undefined,
      },
    },
  }
}

const COLUNAS_PRODUTO =
  'id, ativo, categoria_id, nome, descricao, preco_centavos, preco_original_centavos, foto_path, eh_combo, disponivel, ordem, ' +
  'grupos_opcao(id, nome, min_escolhas, max_escolhas, ordem, ' +
  'opcoes(id, ativo, nome, preco_adicional_centavos, produto_id, disponivel, ordem))'

export async function carregarDoSupabase(client: SupabaseClient): Promise<Cardapio> {
  const [categorias, produtos, loja, horarios] = await Promise.all([
    client.from('categorias').select('id, nome, descricao, ordem, ativo').order('ordem'),
    client.from('produtos').select(COLUNAS_PRODUTO).order('ordem'),
    client
      .from('configuracoes_loja')
      .select(
        'nome, fuso_horario, modo, latitude, longitude, frete_base_centavos, frete_por_km_centavos, raio_maximo_km, pedido_minimo_centavos, tempo_preparo_min',
      )
      .eq('id', 1)
      .single(),
    client.from('horarios_funcionamento').select('dia_semana, abre, fecha'),
  ])

  const falha = categorias.error ?? produtos.error ?? loja.error ?? horarios.error
  if (falha) throw new Error(`Falha ao ler o cardápio: ${falha.message}`)

  return montarCardapio(
    {
      categorias: categorias.data as LinhaCategoria[],
      produtos: produtos.data as unknown as LinhaProduto[],
      loja: loja.data as LinhaLoja,
      horarios: horarios.data as LinhaHorario[],
    },
    (caminho) => client.storage.from(BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl,
  )
}
