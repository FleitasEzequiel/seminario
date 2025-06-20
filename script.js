let model;
let modeloCargado = false;
let historial = [];

const passageTextarea = document.getElementById("passage");
const buscarBtn = document.getElementById("buscarBtn");

buscarBtn.disabled = true;

async function cargarModelo() {
  try {
    console.log("Cargando modelo...");
    model = await qna.load(); 
    modeloCargado = true;
    toast("Modelo cargado. Haz una pregunta para comenzar");
    buscarBtn.disabled = false;
  } catch (error) {
    toast("Error al cargar el modelo, por favor reinicie la página")
  }
}

cargarModelo();

function toast(texto) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = texto;
  toast.addEventListener("click", () => toast.remove());
  document.body.appendChild(toast);
}

async function traducir(texto, desde = "es", a = "en") {
  try {
    const detect = await fetch("https://translation.googleapis.com/language/translate/v2/detect",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-goog-api-key":API_KEY
      },
      body: JSON.stringify({
        q:texto,
      })
    })
    const lenguaje = await detect.json().then((json)=>json.data.detections[0][0].language)
    if (lenguaje !== a){
      var response = await fetch("https://translation.googleapis.com/language/translate/v2", {
        method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify({
        q: texto,
        target: a,
        format: "text"
      })
    });
  }

  if (!response.ok) throw new Error(`Error de traducción: ${response.status}`);
  const data = await response.json();
    return data.data.translations[0].translatedText || texto;
  } catch (error) {
    return texto; 
  }
}

function actualizarChat() {
  const grid = document.querySelector(".grid1");
  const mensaje = document.createElement("div");

  historial.map((msg, i) => {
    mensaje.className = (i % 2 === 0) ? "msgPregunta" : "msgRespuesta";
    mensaje.innerText = msg;
    grid.appendChild(mensaje);
  });
}

function leerTexto(texto) {
  try {
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance(texto);
      msg.lang = "es-ES";
      msg.rate = 0.8;
      window.speechSynthesis.speak(msg);
    }
  } catch (error) {
  }
}

async function leerArchivo(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;

  try {
    if (archivo.type === "text/plain") {
      const texto = await archivo.text();
      passageTextarea.value = texto;
      toast("Archivo de texto cargado correctamente.");
    } else if (archivo.type === "application/pdf") {
      toast("Procesando PDF...");

      const reader = new FileReader();
      reader.onload = async function () {
        try {
          const typedarray = new Uint8Array(reader.result);
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          let textoCompleto = "";

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const textItems = content.items.map(item => item.str).join(" ");
            textoCompleto += textItems + "\n\n";
          }

          passageTextarea.value = textoCompleto.trim();
          toast(`PDF procesado correctamente. ${pdf.numPages} páginas leídas.`);
        } catch (error) {
          toast("Error al procesar el PDF.");
        }
      };

      reader.readAsArrayBuffer(archivo);
    } else {
      alert("Formato no soportado. Solo se permiten archivos .txt o .pdf");
    }
  } catch (error) {
    toast("Error al leer el archivo.");
  }
}

async function preguntar() {
  const passage = passageTextarea.value.trim();
  const preguntaES = document.getElementById("question").value.trim();

  if (!modeloCargado) {
    toast("El modelo aún se está cargando, espera un momento...");
    return;
  }

  try {
    buscarBtn.disabled = true;

    const preguntaEN = await traducir(preguntaES, "es", "en");
    historial.push(preguntaES);
    actualizarChat();

    const passageEN = await traducir(passage, "auto", "en");

    const answers = await model.findAnswers(preguntaEN, passageEN);

    if (answers && answers.length > 0 && answers[0].score > 0.1) {
      const respuestaEN = answers[0].text;
      const respuestaES = await traducir(respuestaEN, "en", "es");

      leerTexto(respuestaES); 
      historial.push(respuestaES);
      actualizarChat();

      document.getElementById("question").value = "";

    } else {
      historial.push("No se encontró una respuesta.");
      toast("No se encontró una respuesta adecuada en el texto proporcionado.");
    }
  } catch (error) {
    historial.push("Error al procesar la pregunta.");
    toast("Error al procesar la pregunta.");
  } finally {
    buscarBtn.disabled = false;
  }
}


actualizarChat();
