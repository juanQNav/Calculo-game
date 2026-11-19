# Cálculo A — Juego de Derivadas e Integrales

Sitio estático para estudiantes de Cálculo A. Practica derivadas e integrales en tres modos que comparten progreso — Cartas, Detective y Aventura — o repasa primero el **Formulario** con pestañas de Derivación e Integración. El botón **Home** siempre vuelve a la pantalla de bienvenida. El avance se guarda en el navegador con `localStorage`. En el modo Cartas, una tarjeta marcada para repasar se vuelve a mostrar priorizada después de completar otras dos cartas.

**Jugar en línea:** [Cálculo A en GitHub Pages](https://juanqnav.github.io/Calculo-game/).

## Vista previa local

Usa un servidor local ligero para probar las rutas relativas y el guardado en `localStorage`:

```bash
python3 -m http.server 8000
# Luego visita http://localhost:8000
```

## Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a un repositorio de GitHub.
2. Ve a **Settings → Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch** y elige `main` con la carpeta `/ (root)`.
4. Guarda; en unos minutos estará disponible en `https://<usuario>.github.io/<repo>/`.

Las URLs de activos son relativas, por lo que funcionan tanto en raíz como bajo `/<repo>/`.

## Estructura

```
index.html        # Punto de entrada, navegación Home/Formulario y vistas
js/content.js     # Banco de preguntas, currículo y catálogo de fórmulas
js/app.js         # Lógica del juego, navegación y persistencia
css/styles.css    # Tema Catppuccin Mocha y diseño responsive
tests/verify.js   # Verificación ligera con Node
```

## Verificación

```bash
node tests/verify.js
```

Revisa la sintaxis de los archivos JS y ejecuta pruebas enfocadas del banco de preguntas, del catálogo de fórmulas, de la navegación Home/Formulario y del cambio de pestañas.

## Alcance del MVP

- Navegación principal con Home y Formulario.
- Tres modos con progreso compartido: Cartas, Detective y Aventura.
- Formulario dividido en Derivación e Integración, con fórmulas agrupadas por familia y explicaciones (`Qué`, `Por qué`, `Dónde/cuándo usarla`, `Tip`).
- Derivadas e integrales del formulario local y la imagen de NotebookLM, excluyendo explícitamente las formas racionales 29 y 30 de la imagen.
- Sin dependencias externas ni paso de compilación.
