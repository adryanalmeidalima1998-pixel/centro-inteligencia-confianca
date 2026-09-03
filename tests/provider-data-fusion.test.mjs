import test from 'node:test'
import assert from 'node:assert/strict'

import { pairProviderPlayers } from '../data/provider-data-fusion.js'

function player(nome, extra = {}) {
  return {
    nome,
    idade: 24,
    pais: 'Brasil',
    posicao: 'CF',
    equipa: 'Confiança',
    ...extra,
  }
}

function matchedPair(pairs) {
  return pairs.find(item => item.sportsbase && item.wyscout)
}

test('associa o mesmo atleta mesmo com acentos e partículas diferentes', () => {
  const sportsbase = [player('João Pedro da Silva', { data_nascimento: '2002-04-10' })]
  const wyscout = [player('Joao Pedro Silva', { data_nascimento: '2002-04-10' })]

  const match = matchedPair(pairProviderPlayers(sportsbase, wyscout))

  assert.ok(match)
  assert.equal(match.wyscout.nome, 'Joao Pedro Silva')
  assert.ok(match.matchQuality >= 0.8)
})

test('aceita abreviação quando existem evidências independentes suficientes', () => {
  const sportsbase = [player('Kevin Stiben Viveros Rodallega', {
    idade: 26,
    pais: 'Colômbia',
    equipa: 'Athletico Paranaense',
    posicao: 'CF',
  })]
  const wyscout = [player('K. Viveros', {
    idade: 26,
    pais: 'Colômbia',
    equipa: 'Athletico Paranaense',
    posicao: 'CF',
  })]

  const match = matchedPair(pairProviderPlayers(sportsbase, wyscout))

  assert.ok(match)
  assert.equal(match.wyscout.nome, 'K. Viveros')
  assert.match(match.matchReason, /(initial_surname|surname_initial)/)
})

test('não associa homônimo quando a data de nascimento diverge', () => {
  const sportsbase = [player('Lucas Silva', { data_nascimento: '2001-01-10' })]
  const wyscout = [player('Lucas Silva', { data_nascimento: '1998-08-20' })]

  const pairs = pairProviderPlayers(sportsbase, wyscout)

  assert.equal(matchedPair(pairs), undefined)
  assert.equal(pairs.filter(item => item.sportsbase && !item.wyscout).length, 1)
  assert.equal(pairs.filter(item => !item.sportsbase && item.wyscout).length, 1)
})

test('não força match quando dois candidatos são ambíguos', () => {
  const sportsbase = [player('Carlos E Souza', {
    idade: 23,
    equipa: '',
    pais: '',
    posicao: '',
  })]
  const wyscout = [
    player('Carlos Eduardo Souza', { idade: 23, equipa: '', pais: '', posicao: '' }),
    player('Carlos Emanuel Souza', { idade: 23, equipa: '', pais: '', posicao: '' }),
  ]

  const pairs = pairProviderPlayers(sportsbase, wyscout)
  const sportsbaseResult = pairs.find(item => item.sportsbase)

  assert.equal(sportsbaseResult.wyscout, null)
  assert.match(sportsbaseResult.matchReason, /^ambiguous_or_low_confidence:/)
})

test('usa clube, idade e posição para escolher o candidato correto', () => {
  const sportsbase = [player('Rafael Santos', {
    idade: 22,
    equipa: 'Confiança',
    posicao: 'RB',
    pais: 'Brasil',
  })]
  const wyscout = [
    player('Rafael Santos', { idade: 22, equipa: 'Confiança', posicao: 'RB', pais: 'Brasil' }),
    player('Rafael Santos', { idade: 30, equipa: 'Outro Clube', posicao: 'CF', pais: 'Brasil' }),
  ]

  const match = matchedPair(pairProviderPlayers(sportsbase, wyscout))

  assert.ok(match)
  assert.equal(match.wyscout.equipa, 'Confiança')
  assert.equal(match.wyscout.posicao, 'RB')
})

test('aceita erro leve de digitação quando nascimento, clube e posição confirmam a identidade', () => {
  const sportsbase = [player('Matheus Henrique', {
    data_nascimento: '2001-09-14',
    equipa: 'Confiança',
    posicao: 'CMF',
  })]
  const wyscout = [player('Mateus Henrique', {
    data_nascimento: '2001-09-14',
    equipa: 'Confiança',
    posicao: 'CMF',
  })]

  const match = matchedPair(pairProviderPlayers(sportsbase, wyscout))

  assert.ok(match)
  assert.equal(match.wyscout.nome, 'Mateus Henrique')
})

test('não associa jogadores de mesmo nome quando a idade é incompatível', () => {
  const sportsbase = [player('Pedro Henrique', { idade: 20 })]
  const wyscout = [player('Pedro Henrique', { idade: 25 })]

  assert.equal(matchedPair(pairProviderPlayers(sportsbase, wyscout)), undefined)
})

test('reconhece nome reduzido por subconjunto de tokens', () => {
  const sportsbase = [player('Gabriel Barbosa Almeida', {
    idade: 24,
    equipa: 'Confiança',
    posicao: 'CF',
  })]
  const wyscout = [player('Gabriel Barbosa', {
    idade: 24,
    equipa: 'Confiança',
    posicao: 'CF',
  })]

  const match = matchedPair(pairProviderPlayers(sportsbase, wyscout))

  assert.ok(match)
  assert.equal(match.wyscout.nome, 'Gabriel Barbosa')
})

test('mantém registros sem par em vez de forçar associação', () => {
  const sportsbase = [player('Atleta SportsBase', { idade: 21 })]
  const wyscout = [player('Outro Jogador', { idade: 30 })]

  const pairs = pairProviderPlayers(sportsbase, wyscout)

  assert.equal(pairs.filter(item => item.sportsbase && !item.wyscout).length, 1)
  assert.equal(pairs.filter(item => !item.sportsbase && item.wyscout).length, 1)
})
