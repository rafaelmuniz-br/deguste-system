import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, anon, clienteLogado, como, criarBanco } from './helpers.ts'

let db: PGlite

beforeAll(async () => {
  db = await criarBanco()
}, 60_000)

afterAll(async () => {
  await db.close()
})

const config = {
  nome: 'Deguste Burguer',
  modo: 'automatico',
  endereco: 'Rua Exemplo, 100 - Salvador',
  latitude: -12.97,
  longitude: -38.5,
  frete_base_centavos: 500,
  frete_por_km_centavos: 200,
  raio_maximo_km: 7.5,
  pedido_minimo_centavos: 2000,
  tempo_preparo_min: 40,
}
const horarios = [
  { dia_semana: 3, abre: '18:00', fecha: '22:00' },
  { dia_semana: 5, abre: '12:00', fecha: '15:00' },
  { dia_semana: 5, abre: '18:00', fecha: '23:00' },
]

const salvar = (papel: typeof admin, c: object = config, h: object[] = horarios) =>
  como(db, papel, () =>
    db.query('select public.salvar_configuracao_loja($1::jsonb, $2::jsonb)', [
      JSON.stringify(c),
      JSON.stringify(h),
    ]),
  )

const lerConfig = () =>
  como(db, anon, async () => (await db.query<Record<string, unknown>>('select * from public.configuracoes_loja')).rows[0])
const lerHorarios = () =>
  como(db, anon, async () =>
    (
      await db.query<{ dia_semana: number; abre: string; fecha: string }>(
        `select dia_semana, abre::text, fecha::text from public.horarios_funcionamento order by dia_semana, abre`,
      )
    ).rows,
  )

describe('salvar_configuracao_loja (1.12)', () => {
  it('admin grava configuração e substitui TODOS os horários (vários intervalos por dia)', async () => {
    await salvar(admin)
    const c = await lerConfig()
    expect(c).toMatchObject({
      modo: 'automatico',
      frete_base_centavos: 500,
      frete_por_km_centavos: 200,
      pedido_minimo_centavos: 2000,
      tempo_preparo_min: 40,
      endereco: 'Rua Exemplo, 100 - Salvador',
    })
    expect(Number(c.raio_maximo_km)).toBe(7.5)
    expect(await lerHorarios()).toEqual([
      { dia_semana: 3, abre: '18:00:00', fecha: '22:00:00' },
      { dia_semana: 5, abre: '12:00:00', fecha: '15:00:00' },
      { dia_semana: 5, abre: '18:00:00', fecha: '23:00:00' },
    ])
  })

  it('o público (anon) enxerga a nova configuração e os horários', async () => {
    await salvar(admin, { ...config, modo: 'forcar_fechada' })
    expect((await lerConfig()).modo).toBe('forcar_fechada')
  })

  it('lista de horários vazia = loja sem horário (só abre no modo forçado)', async () => {
    await salvar(admin, config, [])
    expect(await lerHorarios()).toEqual([])
  })

  it('coordenadas e endereço em branco viram nulos', async () => {
    await salvar(admin, { ...config, endereco: '  ', latitude: null, longitude: null })
    const c = await lerConfig()
    expect(c.endereco).toBeNull()
    expect(c.latitude).toBeNull()
    expect(c.longitude).toBeNull()
  })

  it('ATÔMICO: horário inválido (fecha antes de abrir) não muda NADA, nem a configuração nem os horários antigos', async () => {
    await salvar(admin, { ...config, tempo_preparo_min: 25 }, [{ dia_semana: 4, abre: '18:00', fecha: '22:00' }])
    const antesConfig = await lerConfig()
    const antesHorarios = await lerHorarios()

    await expect(
      salvar(admin, { ...config, tempo_preparo_min: 99 }, [{ dia_semana: 4, abre: '22:00', fecha: '18:00' }]),
    ).rejects.toThrow()

    expect(await lerConfig()).toEqual(antesConfig)
    expect(await lerHorarios()).toEqual(antesHorarios)
  })

  it('ATÔMICO: configuração inválida (raio negativo) também desfaz os horários novos', async () => {
    await salvar(admin, config, [{ dia_semana: 2, abre: '10:00', fecha: '12:00' }])
    await expect(salvar(admin, { ...config, raio_maximo_km: -1 }, [{ dia_semana: 6, abre: '10:00', fecha: '12:00' }])).rejects.toThrow()
    expect(await lerHorarios()).toEqual([{ dia_semana: 2, abre: '10:00:00', fecha: '12:00:00' }])
  })

  it('dois intervalos começando na mesma hora no mesmo dia são recusados', async () => {
    await expect(
      salvar(admin, config, [
        { dia_semana: 3, abre: '18:00', fecha: '20:00' },
        { dia_semana: 3, abre: '18:00', fecha: '22:00' },
      ]),
    ).rejects.toThrow()
  })

  it('modo desconhecido é recusado', async () => {
    await expect(salvar(admin, { ...config, modo: 'abrir_tudo' })).rejects.toThrow()
  })

  it('quem não é admin não consegue: anônimo e cliente logado', async () => {
    await salvar(admin, config, horarios)
    const antes = await lerHorarios()
    await expect(salvar(anon as typeof admin)).rejects.toThrow()
    await expect(salvar(clienteLogado)).rejects.toThrow(/sem_permissao/)
    expect(await lerHorarios()).toEqual(antes)
  })
})
