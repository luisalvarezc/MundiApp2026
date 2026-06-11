# Bitácora de Ideas y Futuras Mejoras - Quiniela Mundial 2026

Este archivo sirve como registro de ideas, propuestas y dinámicas de juego sugeridas por la comunidad o los organizadores que pueden ser implementadas en versiones futuras de la aplicación.

---

## 📌 1. Sistema de Predicción de Campeón Mundial

### Opción B: El Comodín de "Segunda Oportunidad" (Ideal para familias)
Para evitar que un familiar pierda el interés si su campeón se va a casa temprano, se puede habilitar una fase de repesca.

* **Dinámica**: Si el campeón inicial elegido por un usuario es eliminado antes de los Octavos de Final, el sistema le otorgará una ventana de tiempo para elegir un nuevo campeón de entre los equipos que siguen clasificados en el torneo.
* **Sistema de Puntaje Compensado**: Para mantener la justicia deportiva con respecto a quienes conservan a sus candidatos iniciales vivos:
  * El campeón original elegido antes de iniciar el mundial otorga el puntaje máximo completo (ej. **15 puntos**).
  * El segundo campeón de rescate elegido en la repesca otorga un puntaje reducido (ej. **5 puntos**).

---

## 📌 2. Trivia Mundialista Diaria (Propuesta de Dinámica)

### Idea General
Introducir una sección de **Trivia** diaria en la que los jugadores puedan responder de 1 a 2 preguntas sobre la historia de los mundiales o detalles del mundial actual (en este caso, el de 2026). Cada respuesta correcta otorgará un punto extra (ej. **1 punto por acierto**), lo que sirve como incentivo adicional de participación.

### Análisis de Factibilidad

#### 1. ¿De dónde se extrae la información?
* **Bases de datos estáticas / Generadas**: Al contar con acceso a modelos avanzados de IA (como Gemini), puedo estructurar una base de datos local y curada con más de 100 o 200 preguntas de trivia histórica (de excelente nivel, validadas y sin errores) directamente en un archivo de configuración del proyecto (`src/data/trivia.ts`) o subirlas a una colección de Firestore. No se requiere contratar APIs externas ni servicios de consulta de datos de terceros.
* **Preguntas Dinámicas en Vivo**: Adicionalmente, durante el torneo, se podrían ingresar manualmente (vía Panel de Administración) preguntas sobre eventos que ocurrieron *el día anterior* (ej. "¿Quién anotó el gol de la victoria en el partido de ayer entre México y Polonia?"), lo que añade un gran sentido de actualidad.

#### 2. Dinámica de Juego y Reglas Sugeridas
Para evitar que se pierda la equidad, se proponen los siguientes lineamientos:
* **Límite de Tiempo (Anti-Segundeo / Google)**: Una vez que el jugador pulsa "Iniciar Trivia del Día", se activa un temporizador (ej. de 20 a 30 segundos por pregunta) para evitar que puedan buscar las respuestas en Google.
* **Bloqueo de Intento**: Un solo intento por pregunta. Una vez seleccionada una opción, se guarda su respuesta en la base de datos (para usuarios ingresados con cuenta) o en estado local (para modo invitado) y no se puede modificar.
* **Ventana de Disponibilidad**: Cada pregunta estará disponible únicamente durante 24 horas. Al pasar al día siguiente, se cierra esa pregunta y se publica el resultado oficial.

#### 3. Viabilidad Técnica
* **Nivel de esfuerzo**: Medio.
* **Componentes clave**:
  1. Nueva pestaña o sección visible de "Trivia" (con diseño atractivo e interactivo).
  2. Colección de `trivia` y subcolección de `respuestas_trivia` en Firestore (asociada al perfil del jugador para que sume a su puntaje global).
  3. Mecánica de actualización de puntajes generales en la tabla de clasificación.

