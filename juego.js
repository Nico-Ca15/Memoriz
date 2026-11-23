let canalUrl = '';
let eventSourceActivo = null;
const miIdUnico = 'analista_' + Math.random().toString(36).substring(2, 9);
let conectado = false;
let sonidoActivo = true;

let ronda = 1;
const MAX_RONDAS = 7;
const META_VICTORIAS = 4;

let saldoMio = 100;
let saldoRival = 100;
let puntosMios = 0;
let puntosRival = 0;
let serieMia = 0;
let serieRival = 0;

let miOferta = null;
let rivalOferta = null;
let partidaTerminada = false;

function tocarSonido(tipo) {
  if (!sonidoActivo) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const ahora = ctx.currentTime;
    gain.gain.setValueAtTime(0.06, ahora);

    if (tipo === 'oferta') {
      osc.frequency.setValueAtTime(520, ahora);
      osc.frequency.exponentialRampToValueAtTime(680, ahora + 0.09);
      osc.start(ahora);
      osc.stop(ahora + 0.09);
    } else if (tipo === 'ganar') {
      osc.frequency.setValueAtTime(523, ahora);
      osc.frequency.setValueAtTime(659, ahora + 0.08);
      osc.frequency.setValueAtTime(784, ahora + 0.16);
      osc.start(ahora);
      osc.stop(ahora + 0.25);
    } else if (tipo === 'perder') {
      osc.frequency.setValueAtTime(360, ahora);
      osc.frequency.exponentialRampToValueAtTime(220, ahora + 0.22);
      osc.start(ahora);
      osc.stop(ahora + 0.22);
    } else if (tipo === 'chat') {
      osc.frequency.setValueAtTime(740, ahora);
      osc.start(ahora);
      osc.stop(ahora + 0.05);
    }
  } catch (e) {}
}

function toggleSonido() {
  sonidoActivo = !sonidoActivo;
  document.getElementById('btn-sonido').innerText = sonidoActivo ? '🔊 Audio' : '🔇 Silencio';
}

function entrarSala() {
  const sala = document.getElementById('nombre-sala').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!sala) return;

  if (eventSourceActivo) {
    eventSourceActivo.close();
  }

  canalUrl = "https://ntfy.sh_" + sala;
  const badge = document.getElementById('badge-estado');
  badge.innerText = 'Conectando...';
  document.getElementById('estado-sala').innerText = `Conectando a sala "${sala}"... Esperando al compañero.`;
  document.getElementById('btn-conectar').disabled = true;

  eventSourceActivo = new EventSource(`${canalUrl}/sse`);

  eventSourceActivo.onopen = () => {
    enviarDato({ tipo: 'HOLA' });
  };

  eventSourceActivo.onmessage = (event) => {
    try {
      const paquete = JSON.parse(event.data);
      if (!paquete.message) return;

      const datos = JSON.parse(paquete.message);
      if (datos.emisor === miIdUnico) return;

      if (datos.tipo === 'HOLA') {
        if (!conectado) {
          activarTablero(sala);
        }
        enviarDato({ tipo: 'HOLA_RESPUESTA' });
      } else if (datos.tipo === 'HOLA_RESPUESTA') {
        if (!conectado) {
          activarTablero(sala);
        }
      } else if (datos.tipo === 'OFERTA') {
        rivalOferta = datos.valor;
        const pill = document.getElementById('estado-rival-ronda');
        pill.innerText = 'Rival listo ✅';
        pill.classList.add('listo');
        agregarChat('Sistema: El analista remoto ya fijó su oferta secreta.', 'chat-sistema');
        verificarResolucion();
      } else if (datos.tipo === 'CHAT') {
        tocarSonido('chat');
        agregarChat(`Remoto: ${datos.texto}`, 'chat-rival');
      } else if (datos.tipo === 'REINICIAR') {
        reiniciarPartidaCompleta(false);
      }
    } catch (e) {}
  };
}

function activarTablero(sala) {
  conectado = true;
  document.getElementById('panel-conexion').style.display = 'none';
  document.getElementById('panel-juego').style.display = 'block';
  const badge = document.getElementById('badge-estado');
  badge.innerText = `Sala: ${sala} (En línea)`;
  badge.classList.add('online');
  document.getElementById('input-oferta').focus();
  tocarSonido('ganar');
  agregarChat('Sistema: Sesión iniciada. Presupuesto inicial: 100 créditos cada uno.', 'chat-sistema');
}

function enviarDato(objeto) {
  if (!canalUrl) return;
  objeto.emisor = miIdUnico;
  fetch(canalUrl, {
    method: 'POST',
    body: JSON.stringify(objeto)
  }).catch(() => {});
}
function fijarRapido(cantidad) {
  const input = document.getElementById('input-oferta');
  input.value = Math.min(cantidad, saldoMio);
  input.focus();
}

function fijarPorcentaje(factor) {
  const input = document.getElementById('input-oferta');
  input.value = Math.floor(saldoMio * factor);
  input.focus();
}

function enviarOferta() {
  if (!conectado || partidaTerminada || miOferta !== null) return;

  const input = document.getElementById('input-oferta');
  const valor = parseInt(input.value, 10);

  if (isNaN(valor) || valor < 0 || valor > saldoMio) {
    alert(`Ingresa un monto válido entre 0 y ${saldoMio}.`);
    return;
  }

  miOferta = valor;
  input.value = '';
  document.getElementById('zona-controles').style.display = 'none';
  document.getElementById('instruccion').innerHTML = `Oferta fijada: <strong>${miOferta} créditos</strong>. Esperando al analista remoto...`;

  tocarSonido('oferta');
  enviarDato({ tipo: 'OFERTA', valor: miOferta });
  verificarResolucion();
}

function verificarResolucion() {
  if (miOferta !== null && rivalOferta !== null) {
    saldoMio -= miOferta;
    saldoRival -= rivalOferta;

    let ganadorTexto = '';
    let claseFila = '';

    if (miOferta > rivalOferta) {
      puntosMios++;
      ganadorTexto = 'Tú (+1)';
      claseFila = 'fila-ganada';
      tocarSonido('ganar');
    } else if (rivalOferta > miOferta) {
      puntosRival++;
      ganadorTexto = 'Rival (+1)';
      claseFila = 'fila-perdida';
      tocarSonido('perder');
    } else {
      ganadorTexto = 'Empate (0)';
    }

    document.getElementById('pts-mios').innerText = puntosMios;
    document.getElementById('pts-rival').innerText = puntosRival;
    document.getElementById('saldo-mio').innerText = saldoMio;
    document.getElementById('saldo-rival').innerText = saldoRival;
    document.getElementById('barra-saldo-mio').style.width = `${saldoMio}%`;
    document.getElementById('barra-saldo-rival').style.width = `${saldoRival}%`;

    agregarFilaHistorial(ronda, miOferta, rivalOferta, ganadorTexto, claseFila);

    if (puntosMios >= META_VICTORIAS || puntosRival >= META_VICTORIAS || ronda >= MAX_RONDAS) {
      finalizarPartida();
    } else {
      prepararSiguienteRonda();
    }
  }
}

function agregarFilaHistorial(r, mio, riv, res, claseFila) {
  const filaVacia = document.getElementById('fila-vacia');
  if (filaVacia) filaVacia.remove();

  const tbody = document.getElementById('tabla-historial');
  const fila = `<tr class="${claseFila}">
    <td>#${r}</td>
    <td>${mio} cr</td>
    <td>${riv} cr</td>
    <td><strong>${res}</strong></td>
  </tr>`;
  tbody.innerHTML = fila + tbody.innerHTML;
}

function prepararSiguienteRonda() {
  ronda++;
  miOferta = null;
  rivalOferta = null;

  const pill = document.getElementById('estado-rival-ronda');
  pill.innerText = 'Rival pensando...';
  pill.classList.remove('listo');

  document.getElementById('num-ronda').innerText = ronda;
  const restantes = MAX_RONDAS - ronda + 1;
  document.getElementById('rondas-restantes').innerText = `${restantes} ${restantes === 1 ? 'restante' : 'restantes'}`;

  const input = document.getElementById('input-oferta');
  input.max = saldoMio;
  input.placeholder = `Monto (0 - ${saldoMio})`;

  document.getElementById('instruccion').innerHTML =
    `Ingresa tu oferta secreta (0 a <span id="max-apuesta">${saldoMio}</span>) y presiona <span class="tecla">Enter</span>:`;
  document.getElementById('zona-controles').style.display = 'block';
  input.focus();
}

function finalizarPartida() {
  partidaTerminada = true;
  let mensajeFinal = '';
  if (puntosMios > puntosRival) {
    serieMia++;
    mensajeFinal = '🏆 ¡GANASTE LA LICITACIÓN!';
    tocarSonido('ganar');
  } else if (puntosRival > puntosMios) {
    serieRival++;
    mensajeFinal = '📉 EL ANALISTA REMOTO GANÓ LA LICITACIÓN.';
    tocarSonido('perder');
  } else {
    mensajeFinal = '🤝 EMPATE TÉCNICO AL FINAL DE LAS 7 RONDAS.';
  }

  document.getElementById('serie-mia').innerText = serieMia;
  document.getElementById('serie-rival').innerText = serieRival;

  const pill = document.getElementById('estado-rival-ronda');
  pill.innerText = 'Serie cerrada';
  pill.classList.remove('listo');

  document.getElementById('instruccion').innerHTML =
    `<strong>${mensajeFinal}</strong> <button onclick="reiniciarPartidaCompleta(true)" style="margin-left:10px;">Nueva Serie</button>`;
  agregarChat(`Sistema: ${mensajeFinal}`, 'chat-sistema');
}

function reiniciarPartidaCompleta(notificar) {
  if (notificar) enviarDato({ tipo: 'REINICIAR' });
  ronda = 1;
  saldoMio = 100;
  saldoRival = 100;
  puntosMios = 0;
  puntosRival = 0;
  miOferta = null;
  rivalOferta = null;
  partidaTerminada = false;

  document.getElementById('pts-mios').innerText = '0';
  document.getElementById('pts-rival').innerText = '0';
  document.getElementById('saldo-mio').innerText = '100';
  document.getElementById('saldo-rival').innerText = '100';
  document.getElementById('barra-saldo-mio').style.width = '100%';
  document.getElementById('barra-saldo-rival').style.width = '100%';
  document.getElementById('tabla-historial').innerHTML =
    '<tr id="fila-vacia"><td colspan="4" class="texto-ayuda">Aún no se han cerrado rondas.</td></tr>';

  const pill = document.getElementById('estado-rival-ronda');
  pill.innerText = 'Rival pensando...';
  pill.classList.remove('listo');

  document.getElementById('num-ronda').innerText = '1';
  document.getElementById('rondas-restantes').innerText = '7 restantes';
  const input = document.getElementById('input-oferta');
  input.max = 100;
  input.placeholder = 'Monto (0 - 100)';
  document.getElementById('instruccion').innerHTML =
    'Ingresa tu oferta secreta (0 a <span id="max-apuesta">100</span>) y presiona <span class="tecla">Enter</span>:';
  document.getElementById('zona-controles').style.display = 'block';
  agregarChat('Sistema: Presupuestos reiniciados a 100 créditos.', 'chat-sistema');
}

function enviarChat(e) {
  if (e.key === 'Enter') {
    enviarChatBoton();
  }
}

function enviarChatBoton() {
  const input = document.getElementById('input-chat');
  const texto = input.value.trim();
  if (texto && conectado) {
    enviarDato({ tipo: 'CHAT', texto: texto });
    agregarChat(`Tú: ${texto}`, 'chat-mio');
    input.value = '';
  }
}

function agregarChat(mensaje, clase) {
  const box = document.getElementById('chat-mensajes');
  const div = document.createElement('div');
  div.className = `chat-linea ${clase}`;
  div.innerText = mensaje;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
