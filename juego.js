let canalUrl = '';
const miIdUnico = 'analista_' + Math.random().toString(36).substring(2, 9);
let conectado = false;

let ronda = 1;
const MAX_RONDAS = 7;
const META_VICTORIAS = 4;

let saldoMio = 100;
let saldoRival = 100;
let puntosMios = 0;
let puntosRival = 0;

let miOferta = null;
let rivalOferta = null;
let partidaTerminada = false;

function entrarSala() {
  const sala = document.getElementById('nombre-sala').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!sala) return;

  canalUrl = "https://ntfy.sh_" + sala;
  document.getElementById('badge-estado').innerText = 'Conectando...';
  document.getElementById('estado-sala').innerText = `Conectando a "${sala}"... Dile a tu compañero que entre con la misma clave.`;

  const eventSource = new EventSource(`${canalUrl}/sse`);

  eventSource.onopen = () => {
    enviarDato({ tipo: 'HOLA' });
  };

  eventSource.onmessage = (event) => {
    try {
      const paquete = JSON.parse(event.data);
      if (!paquete.message) return;
      
      const datos = JSON.parse(paquete.message);
      if (datos.emisor === miIdUnico) return;

      if (datos.tipo === 'HOLA') {
        if (!conectado) {
          activarTablero(sala);
          enviarDato({ tipo: 'HOLA_RESPUESTA' });
        }
      } else if (datos.tipo === 'HOLA_RESPUESTA') {
        if (!conectado) {
          activarTablero(sala);
        }
      } else if (datos.tipo === 'OFERTA') {
        rivalOferta = datos.valor;
        agregarChat('Sistema: El analista remoto ya fijó su oferta secreta.', 'chat-sistema');
        verificarResolucion();
      } else if (datos.tipo === 'CHAT') {
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
  document.getElementById('badge-estado').innerText = `Sala: ${sala} (En línea)`;
  document.getElementById('input-oferta').focus();
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

function enviarOferta() {
  if (!conectado || partidaTerminada || miOferta !== null) return;

  const input = document.getElementById('input-oferta');
  const valor = parseInt(input.value);

  if (isNaN(valor) || valor < 0 || valor > saldoMio) {
    alert(`Ingresa un monto válido entre 0 y ${saldoMio}.`);
    return;
  }

  miOferta = valor;
  input.value = '';
  document.getElementById('controles-oferta').style.display = 'none';
  document.getElementById('instruccion').innerText = `Oferta fijada: [${miOferta} créditos]. Esperando al rival...`;

  enviarDato({ tipo: 'OFERTA', valor: miOferta });
  verificarResolucion();
}

function verificarResolucion() {
  if (miOferta !== null && rivalOferta !== null) {
    saldoMio -= miOferta;
    saldoRival -= rivalOferta;

    let ganadorTexto = '';
    if (miOferta > rivalOferta) {
      puntosMios++;
      ganadorTexto = 'Tú (+1 ronda)';
    } else if (rivalOferta > miOferta) {
      puntosRival++;
      ganadorTexto = 'Rival (+1 ronda)';
    } else {
      ganadorTexto = 'Empate (0 pts)';
    }

    document.getElementById('pts-mios').innerText = puntosMios;
    document.getElementById('pts-rival').innerText = puntosRival;
    document.getElementById('saldo-mio').innerText = saldoMio;
    document.getElementById('saldo-rival').innerText = saldoRival;

    agregarFilaHistorial(ronda, miOferta, rivalOferta, ganadorTexto);

    if (puntosMios >= META_VICTORIAS || puntosRival >= META_VICTORIAS || ronda >= MAX_RONDAS) {
      finalizarPartida();
    } else {
      prepararSiguienteRonda();
    }
  }
}

function agregarFilaHistorial(r, mio, riv, res) {
  const tbody = document.getElementById('tabla-historial');
  const fila = `<tr>
    <td>#${r}</td>
    <td>${mio}</td>
    <td>${riv}</td>
    <td><strong>${res}</strong></td>
  </tr>`;
  tbody.innerHTML = fila + tbody.innerHTML;
}

function prepararSiguienteRonda() {
  ronda++;
  miOferta = null;
  rivalOferta = null;

  document.getElementById('num-ronda').innerText = ronda;
  document.getElementById('max-apuesta').innerText = saldoMio;
  const input = document.getElementById('input-oferta');
  input.max = saldoMio;
  input.placeholder = `Monto (0 - ${saldoMio})`;

  document.getElementById('instruccion').innerHTML = 
    `Ingresa tu oferta secreta (0 a <span id="max-apuesta">${saldoMio}</span>) y presiona <span class="tecla">Enter</span>:`;
  document.getElementById('controles-oferta').style.display = 'flex';
  input.focus();
}

function finalizarPartida() {
  partidaTerminada = true;
  let mensajeFinal = '';
  if (puntosMios > puntosRival) {
    mensajeFinal = '¡GANASTE LA LICITACIÓN!';
  } else if (puntosRival > puntosMios) {
    mensajeFinal = 'EL ANALISTA REMOTO GANÓ LA LICITACIÓN.';
  } else {
    mensajeFinal = 'EMPATE TÉCNICO AL FINAL DE LAS 7 RONDAS.';
  }

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
  document.getElementById('tabla-historial').innerHTML = '';

  document.getElementById('num-ronda').innerText = '1';
  const input = document.getElementById('input-oferta');
  input.max = 100;
  input.placeholder = 'Monto (0 - 100)';
  document.getElementById('instruccion').innerHTML = 
    'Ingresa tu oferta secreta (0 a <span id="max-apuesta">100</span>) y presiona <span class="tecla">Enter</span>:';
  document.getElementById('controles-oferta').style.display = 'flex';
  agregarChat('Sistema: Presupuestos reiniciados a 100 créditos.', 'chat-sistema');
}

function enviarChat(e) {
  if (e.key === 'Enter') {
    const input = document.getElementById('input-chat');
    const texto = input.value.trim();
    if (texto && conectado) {
      enviarDato({ tipo: 'CHAT', texto: texto });
      agregarChat(`Tú: ${texto}`, 'chat-mio');
      input.value = '';
    }
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
