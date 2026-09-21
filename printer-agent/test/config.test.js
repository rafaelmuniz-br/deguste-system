import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { errosDeCredenciais, lerConfig } from '../src/config.js'

describe('configuração', () => {
  it('valores padrão: teste em arquivo, papel de 80 mm, acentos CP860', () => {
    const { config, erros } = lerConfig({})
    assert.deepEqual(erros, [])
    assert.equal(config.impressora.tipo, 'arquivo')
    assert.equal(config.largura, 48)
    assert.equal(config.acentos, 'cp860')
    assert.equal(config.intervaloMs, 3000)
  })

  it('impressora de rede: exige o host e usa a porta 9100 por padrão', () => {
    assert.ok(lerConfig({ IMPRESSORA_TIPO: 'rede' }).erros.some((e) => e.includes('IMPRESSORA_HOST')))
    const { config, erros } = lerConfig({ IMPRESSORA_TIPO: 'rede', IMPRESSORA_HOST: '192.168.0.50' })
    assert.deepEqual(erros, [])
    assert.deepEqual(config.impressora, { tipo: 'rede', host: '192.168.0.50', porta: 9100 })
  })

  it('impressora do Windows: exige o nome de compartilhamento', () => {
    assert.ok(lerConfig({ IMPRESSORA_TIPO: 'windows' }).erros.some((e) => e.includes('IMPRESSORA_NOME')))
    assert.equal(lerConfig({ IMPRESSORA_TIPO: 'windows', IMPRESSORA_NOME: 'COZINHA' }).config.impressora.nome, 'COZINHA')
  })

  it('junta TODOS os problemas de uma vez, em português', () => {
    const { erros } = lerConfig({ IMPRESSORA_TIPO: 'bluetooth', IMPRESSORA_LARGURA: '40', IMPRESSORA_ACENTOS: 'utf8', INTERVALO_MS: '10' })
    assert.equal(erros.length, 4)
    assert.ok(erros.some((e) => e.includes('desconhecido')))
    assert.ok(erros.some((e) => e.includes('LARGURA')))
    assert.ok(erros.some((e) => e.includes('ACENTOS')))
    assert.ok(erros.some((e) => e.includes('INTERVALO_MS')))
  })

  it('ignora espaços em volta dos valores', () => {
    assert.equal(lerConfig({ IMPRESSORA_TIPO: '  rede ', IMPRESSORA_HOST: ' 10.0.0.1 ' }).config.impressora.host, '10.0.0.1')
  })

  it('credenciais do banco só são cobradas para rodar de verdade', () => {
    const { config } = lerConfig({})
    assert.deepEqual(errosDeCredenciais(config).length, 4)
    const completo = lerConfig({ SUPABASE_URL: 'u', SUPABASE_ANON_KEY: 'k', AGENTE_EMAIL: 'e', AGENTE_SENHA: 's' }).config
    assert.deepEqual(errosDeCredenciais(completo), [])
  })
})
