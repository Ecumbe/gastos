// ======================================================================
// auth.js - Seguridad y Cifrado con Supabase Auth
// ======================================================================

// 1. Escuchar si el usuario ya está logueado (mantiene la sesión abierta)
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    if (session) {
      // Extraemos "admin" de "admin@mifinanza.app"
      ME = session.user.email.split('@')[0]; 
      $('s-login').classList.add('left');
      $('s-main').classList.remove('off');
      $('tb-user').textContent = ME;
      buildMonthSels();
      fetchData(); // Llamamos a la base de datos en main.js
    }
  } else if (event === 'SIGNED_OUT') {
    ME = null;
    DB_GASTOS = [];
    DB_INGRESOS = {};
    $('s-login').classList.remove('left');
    $('s-main').classList.add('off');
    $('li-user').value = '';
    $('li-pass').value = '';
    
    // Restaurar el botón
    const btn = document.querySelector('#s-login .btn-green');
    if(btn) { btn.textContent = 'Ingresar'; btn.disabled = false; }
  }
});

// 2. Función de Login Seguro
window.doLogin = async function() {
  const u = $('li-user').value.trim();
  const p = $('li-pass').value;
  
  if(!u || !p) {
      $('li-err').textContent = 'Ingresa usuario y contraseña';
      return;
  }

  const btn = document.querySelector('#s-login .btn-green');
  btn.textContent = 'Verificando cifrado...';
  btn.disabled = true;

  // Truco: Convertimos el usuario en un correo interno para engañar a Supabase
  const email = `${u.toLowerCase()}@mifinanza.app`;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: p,
  });

  if (error) {
    $('li-err').textContent = 'Usuario o contraseña incorrectos';
    btn.textContent = 'Ingresar';
    btn.disabled = false;
  }
}

// 3. Cerrar Sesión
window.doLogout = async function() {
  await supabaseClient.auth.signOut();
}

// 4. Cambiar Contraseña (Se cifra automáticamente en la base de datos)
window.openChgPass = function() {
  $('pw-old').value=''; $('pw-new').value=''; $('pw-err').textContent='';
  openOv('ov-pw');
}

window.savePass = async function() {
  const oldP = $('pw-old').value;
  const newP = $('pw-new').value;
  
  if (!oldP || !newP) { $('pw-err').textContent = 'Llena ambos campos'; return; }
  if (newP.length < 6) { $('pw-err').textContent = 'Mínimo 6 caracteres'; return; }

  const btn = document.querySelector('#ov-pw .btn-save');
  const originalText = btn.textContent;
  btn.textContent = 'Cifrando...';
  btn.disabled = true;

  // Paso A: Verificamos que se sabe la clave vieja
  const email = `${ME}@mifinanza.app`;
  const { error: signInError } = await supabaseClient.auth.signInWithPassword({
    email: email, password: oldP
  });

  if (signInError) {
    $('pw-err').textContent = 'La contraseña actual es incorrecta';
    btn.textContent = originalText; btn.disabled = false;
    return;
  }

  // Paso B: Le pedimos al servidor que guarde y cifre la nueva
  const { error: updateError } = await supabaseClient.auth.updateUser({
    password: newP
  });

  btn.textContent = originalText;
  btn.disabled = false;

  if (updateError) {
    $('pw-err').textContent = 'Error de conexión. Intenta de nuevo.';
  } else {
    closeOv('ov-pw');
    alert('Contraseña actualizada de forma segura en la nube 🔒');
  }
}
