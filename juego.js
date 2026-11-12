let canalUrl = '';
const miIdUnico = 'analista_' + Math.random().toString(36).substring(2, 9);
let conectado = false;
let ronda = 1;
let miNumero = null;
let rivalNumero = null;
let miPrediccion = null;
let rivalPrediccion = null;
let miDoble = false;
let rivalDoble = false;
let fase = 'ELEGIR_NUMERO';
let puntosMios = 0;
let puntosRival = 0;
const META_PUNTOS = 5;

function entrarSala() {
  const sala = document.getElementById('nombre-sala').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!sala) return;

  canalUrl = "https://ntfy.sh/memoriz_" + sala;
  document.getElementById('badge-estado').innerText = 'Conectando...';
  document.getElementById('estado-sala').innerText = `Conectando al canal "${sala}"... Dile a tu compañero que entre con la misma clave.`;

  // Escuchar mensajes entrantes en tiempo real de forma nativa
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
      } else if (datos.tipo === 'NUMERO') {
        rivalNumero = datos.valor;
        agregarChat('Sistema: El rival ya fijó su número oculto.', 'chat-sistema');
        verificarCambioFase();
      } else if (datos.tipo === 'SUMA') {
        rivalPrediccion = datos.valor;
        rivalDoble = datos.doble;
        const textoDoble = rivalDoble ? ' [CON DOBLE x2]' : '';
        agregarChat(`Sistema: El rival ya envió su predicción${textoDoble}.`, 'chat-sistema');
        verificarResolucion();
      } else if (datos.tipo === 'CHAT') {
        agregarChat(`Remoto: ${datos.texto}`, 'chat-rival');
      } else if (datos.tipo === 'REINICIAR') {
        reiniciarPartidaCompleta(false);
      }
    } catch (e) {
      // Ignorar mensajes de control del servidor
    }
  };
}

function activarTablero(sala) {
  conectado = true;
  document.getElementById('panel-conexion').style.display = 'none';
  document.getElementById('panel-juego').style.display = 'block';
  document.getElementById('badge-estado').innerText = `Sala: ${sala} (En línea)`;
  agregarChat('Sistema: Conexión directa establecida con el par remoto.', 'chat-sistema');
}

function enviarDato(objeto) {
  if (!canalUrl) return;
  objeto.emisor = miIdUnico;
  fetch(canalUrl, {
    method: 'POST',
    body: JSON.stringify(objeto)
  }).catch(() => {});
}

document.addEventListener('keydown', (e) => {
  if (document.activeElement.id === 'input-chat' || document.activeElement.id === 'nombre-sala') return;
  if (!conectado) return;

  const tecla = e.key.toLowerCase();

  if (fase === 'ELEGIR_NUMERO' && ['0', '1', '2', '3'].includes(tecla)) {
    miNumero = parseInt(tecla);
    fase = 'ESPERANDO_NUMERO';
    enviarDato({ tipo: 'NUMERO', valor: miNumero });
    document.getElementById('instruccion').innerText = `Elegiste [${miNumero}]. Esperando al rival...`;
    verificarCambioFase();
  } 
  else if (fase === 'ELEGIR_SUMA') {
    if (tecla === 'd') {
      miDoble = !miDoble;
      document.getElementById('indicador-doble').style.display = miDoble ? 'block' : 'none';
    } else if (['0', '1', '2', '3', '4', '5', '6'].includes(tecla)) {
      miPrediccion = parseInt(tecla);
      fase = 'ESPERANDO_SUMA';
      enviarDato({ tipo: 'SUMA', valor: miPrediccion, doble: miDoble });
      document.getElementById('instruccion').innerText = `Predicción enviada: [${miPrediccion}]. Esperando...`;
      verificarResolucion();
    }
  }
  else if (fase === 'FIN' && tecla === 'r') {
    reiniciarPartidaCompleta(true);
  }
});

function verificarCambioFase() {
  if (miNumero !== null && rivalNumero !== null) {
    fase = 'ELEGIR_SUMA';
    document.getElementById('instruccion').innerHTML = 
      'Adivina la <strong>SUMA TOTAL</strong> (<span class="tecla">0</span> al <span class="tecla">6</span>). Opcional: presiona <span class="tecla">D</span> para Riesgo x2.';
  }
}

function verificarResolucion() {
  if (miPrediccion !== null && rivalPrediccion !== null) {
    const sumaReal = miNumero + rivalNumero;
    let textoResultado = '';

    if (miPrediccion === sumaReal) {
      const ganado = miDoble ? 2 : 1;
      puntosMios += ganado;
      textoResultado = `+${ganado} pt (Tú)`;
    } else if (miDoble) {
      puntosMios = Math.max(0, puntosMios - 1);
      textoResultado = `-1 pt (Fallo x2)`;
    }

    if (rivalPrediccion === sumaReal) {
      const ganadoRival = rivalDoble ? 2 : 1;
      puntosRival += ganadoRival;
      textoResultado += textoResultado ? ` / +${ganadoRival} (Rival)` : `+${ganadoRival} pt (Rival)`;
    } else if (rivalDoble) {
      puntosRival = Math.max(0, puntosRival - 1);
    }

    if (!textoResultado) textoResultado = 'Sin puntos';

    document.getElementById('pts-mios').innerText = puntosMios;
    document.getElementById('pts-rival').innerText = puntosRival;
    agregarFilaHistorial(
      ronda, 
      miNumero, 
      rivalNumero, 
      sumaReal, 
      `${miPrediccion}${miDoble ? '(x2)' : ''} vs ${rivalPrediccion}${rivalDoble ? '(x2)' : ''}`, 
      textoResultado
    );

    if (puntosMios >= META_PUNTOS || puntosRival >= META_PUNTOS) {
      finalizarPartida();
    } else {
      prepararSiguienteRonda();
    }
  }
}

function agregarFilaHistorial(r, mio, riv, suma, preds, res) {
  const tbody = document.getElementById('tabla-historial');
  const fila = `<tr>
    <td>#${r}</td>
    <td>${mio}</td>
    <td>${riv}</td>
    <td><strong>${suma}</strong></td>
    <td>${preds}</td>
    <td>${res}</td>
  </tr>`;
  tbody.innerHTML = fila + tbody.innerHTML;
}

function prepararSiguienteRonda() {
  ronda++;
  miNumero = null;
  rivalNumero = null;
  miPrediccion = null;
  rivalPrediccion = null;
  miDoble = false;
  rivalDoble = false;
  fase = 'ELEGIR_NUMERO';
  document.getElementById('num-ronda').innerText = ronda;
  document.getElementById('indicador-doble').style.display = 'none';
  document.getElementById('instruccion').innerHTML = 
    'Fija tu valor secreto presionando <span class="tecla">0</span> <span class="tecla">1</span> <span class="tecla">2</span> o <span class="tecla">3</span>.';
}

function finalizarPartida() {
  fase = 'FIN';
  const ganador = puntosMios >= META_PUNTOS ? '¡GANASTE LA AUDITORÍA!' : 'EL ANALISTA REMOTO GANÓ LA SERIE.';
  document.getElementById('instruccion').innerHTML = 
    `<strong>${ganador}</strong> Presiona <span class="tecla">R</span> para iniciar una nueva serie.`;
  agregarChat(`Sistema: Fin de la partida. ${ganador}`, 'chat-sistema');
}

function reiniciarPartidaCompleta(notificar) {
  if (notificar) enviarDato({ tipo: 'REINICIAR' });
  ronda = 1;
  puntosMios = 0;
  puntosRival = 0;
  document.getElementById('pts-mios').innerText = '0';
  document.getElementById('pts-rival').innerText = '0';
  document.getElementById('tabla-historial').innerHTML = '';
  prepararSiguienteRonda();
  agregarChat('Sistema: Nueva serie iniciada.', 'chat-sistema');
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
