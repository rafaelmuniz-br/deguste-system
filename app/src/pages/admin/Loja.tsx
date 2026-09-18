import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { ApiLojaAdmin } from '../../data/lojaAdminApi.ts'
import {
  dadosParaForm,
  NOMES_DIAS,
  ORDEM_DIAS,
  validarLoja,
  type FormLoja,
} from '../../domain/adminLoja.ts'
import type { ModoFuncionamento } from '../../domain/tipos.ts'

const MODOS: { valor: ModoFuncionamento; titulo: string; ajuda: string }[] = [
  {
    valor: 'automatico',
    titulo: 'Seguir os horários abaixo',
    ajuda: 'A loja abre e fecha sozinha nos horários de funcionamento. É o normal.',
  },
  {
    valor: 'forcar_aberta',
    titulo: 'Aberta agora, ignorando os horários',
    ajuda:
      'Use para abrir fora do horário (ex.: evento). Lembre de voltar para “Seguir os horários”.',
  },
  {
    valor: 'forcar_fechada',
    titulo: 'Fechada agora, ignorando os horários',
    ajuda:
      'Use quando não dá para atender (acabou o estoque, feriado, imprevisto). O cardápio continua visível, mas ninguém consegue pedir.',
  },
]

const NOVO_INTERVALO = { abre: '18:00', fecha: '22:00' }

export default function Loja({ api }: { api: ApiLojaAdmin }) {
  const [form, setForm] = useState<FormLoja | null>(null)
  const [falha, setFalha] = useState(false)
  const [erros, setErros] = useState<string[]>([])
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const refErros = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async () => {
    try {
      setForm(dadosParaForm(await api.carregar()))
      setFalha(false)
    } catch {
      setFalha(true)
    }
  }, [api])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- carga inicial de dados externos; o setState só ocorre após o await
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (erros.length > 0) refErros.current?.focus()
  }, [erros])

  if (falha) {
    return (
      <p role="alert" className="erros">
        Não foi possível carregar as configurações.{' '}
        <button type="button" className="btn-link" onClick={() => void carregar()}>
          Tentar de novo
        </button>
      </p>
    )
  }
  if (!form) return <p role="status">Carregando…</p>

  const mudar = (parte: Partial<FormLoja>) => {
    setForm({ ...form, ...parte })
    setAviso('')
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const v = validarLoja(form)
    if (!v.ok) {
      setAviso('')
      return setErros(v.erros)
    }
    setErros([])
    setSalvando(true)
    const r = await api.salvar(v.valor)
    setSalvando(false)
    if (r.ok) {
      setAviso('Configurações salvas.')
      await carregar()
    } else {
      setErros([r.mensagem])
    }
  }

  return (
    <section aria-labelledby="titulo-loja">
      <h2 id="titulo-loja">Configurações da loja</h2>

      <form onSubmit={(e) => void salvar(e)} noValidate>
        <fieldset className="admin-bloco">
          <legend>A loja está…</legend>
          {MODOS.map((m) => (
            <label key={m.valor} className="opcao-modo">
              <input
                type="radio"
                name="modo"
                value={m.valor}
                checked={form.modo === m.valor}
                onChange={() => mudar({ modo: m.valor })}
              />
              <span>
                <strong>{m.titulo}</strong>
                <span className="dica">{m.ajuda}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="admin-bloco">
          <legend>Horários de funcionamento</legend>
          <p className="dica">
            Dia sem horário = loja fechada nesse dia. Dá para ter mais de um horário no mesmo dia
            (ex.: almoço e jantar). Os horários são de Salvador (Bahia).
          </p>
          {ORDEM_DIAS.map((dia) => {
            const doDia = form.horarios
              .map((h, indice) => ({ h, indice }))
              .filter(({ h }) => h.dia === dia)
            return (
              <div key={dia} role="group" aria-label={NOMES_DIAS[dia]} className="admin-dia">
                <strong>{NOMES_DIAS[dia]}</strong>
                {doDia.length === 0 && <span className="dica">Fechado</span>}
                {doDia.map(({ h, indice }) => (
                  <div key={indice} className="admin-intervalo">
                    <label>
                      Abre
                      <input
                        type="time"
                        aria-label={`${NOMES_DIAS[dia]}: abre às`}
                        value={h.abre}
                        onChange={(e) =>
                          mudar({
                            horarios: form.horarios.map((x, i) =>
                              i === indice ? { ...x, abre: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Fecha
                      <input
                        type="time"
                        aria-label={`${NOMES_DIAS[dia]}: fecha às`}
                        value={h.fecha}
                        onChange={(e) =>
                          mudar({
                            horarios: form.horarios.map((x, i) =>
                              i === indice ? { ...x, fecha: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-link"
                      aria-label={`Remover horário de ${NOMES_DIAS[dia]} (${h.abre} às ${h.fecha})`}
                      onClick={() =>
                        mudar({ horarios: form.horarios.filter((_, i) => i !== indice) })
                      }
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secundario"
                  aria-label={`Adicionar horário em ${NOMES_DIAS[dia]}`}
                  onClick={() =>
                    mudar({ horarios: [...form.horarios, { dia, ...NOVO_INTERVALO }] })
                  }
                >
                  + Adicionar horário
                </button>
              </div>
            )
          })}
        </fieldset>

        <fieldset className="admin-bloco">
          <legend>Pedidos e entrega</legend>
          <label className="campo">
            Tempo de preparo (minutos)
            <input
              inputMode="numeric"
              value={form.tempoPreparo}
              onChange={(e) => mudar({ tempoPreparo: e.target.value })}
            />
          </label>
          <p className="dica">
            Aparece para o cliente como estimativa e faz o painel da cozinha avisar quando o pedido
            está demorando.
          </p>
          <label className="campo">
            Pedido mínimo (R$)
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={form.pedidoMinimo}
              onChange={(e) => mudar({ pedidoMinimo: e.target.value })}
            />
          </label>
          <label className="campo">
            Taxa de entrega base (R$)
            <input
              inputMode="decimal"
              placeholder="5,00"
              value={form.freteBase}
              onChange={(e) => mudar({ freteBase: e.target.value })}
            />
          </label>
          <label className="campo">
            Valor por km rodado (R$)
            <input
              inputMode="decimal"
              placeholder="1,50"
              value={form.fretePorKm}
              onChange={(e) => mudar({ fretePorKm: e.target.value })}
            />
          </label>
          <p className="dica">
            Frete = taxa base + valor por km × distância. A regra definitiva de cobrança ainda será
            decidida com o Bruno.
          </p>
          <label className="campo">
            Raio máximo de entrega (km)
            <input
              inputMode="decimal"
              value={form.raioKm}
              onChange={(e) => mudar({ raioKm: e.target.value })}
            />
          </label>
        </fieldset>

        <fieldset className="admin-bloco">
          <legend>Identificação e localização</legend>
          <label className="campo">
            Nome da loja
            <input
              value={form.nome}
              maxLength={80}
              onChange={(e) => mudar({ nome: e.target.value })}
            />
          </label>
          <label className="campo">
            Endereço da loja (opcional)
            <input
              value={form.endereco}
              maxLength={200}
              onChange={(e) => mudar({ endereco: e.target.value })}
            />
          </label>
          <label className="campo">
            Latitude
            <input
              inputMode="decimal"
              placeholder="-12,9714"
              value={form.latitude}
              onChange={(e) => mudar({ latitude: e.target.value })}
            />
          </label>
          <label className="campo">
            Longitude
            <input
              inputMode="decimal"
              placeholder="-38,5014"
              value={form.longitude}
              onChange={(e) => mudar({ longitude: e.target.value })}
            />
          </label>
          <p className="dica">
            Latitude e longitude são o ponto de onde a distância da entrega é medida. Para achar: no
            Google Maps, clique com o botão direito no local da loja e copie os dois números.
          </p>
        </fieldset>

        {erros.length > 0 && (
          <div role="alert" className="erros" tabIndex={-1} ref={refErros}>
            <ul>
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {aviso && (
          <p role="status" className="admin-aviso">
            {aviso}
          </p>
        )}
        <button type="submit" className="btn-primario" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </form>
    </section>
  )
}
