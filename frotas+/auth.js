import { db, auth } from './firebase-env.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

window.fazerLogin = async function() {
    const cpfInput = document.getElementById('userCpf');
    const passInput = document.getElementById('userPass');
    const erro = document.getElementById('msgLogin');
    let btnLogin = document.getElementById('btnLogin');

    if (!cpfInput || !passInput) return;

    const c = cpfInput.value.replace(/\D/g, '');
    const p = passInput.value;
    
    if (erro) erro.classList.add('hidden');
    if (!c || !p) return;
    
    window.toggleButtonLoading(btnLogin, true, "Autenticando...");
    
    try {
        const emailFicticio = c + "@feitosa.app";
        await signInWithEmailAndPassword(auth, emailFicticio, p);
        const userSnap = await getDoc(doc(db, "usuarios", c));
        
        if (userSnap.exists() && userSnap.data().ativo !== false) {
            let u = userSnap.data(); 
            u.cpf = c;
            window.USUARIO = u; 
            localStorage.setItem("caatinga_user", JSON.stringify(window.USUARIO)); 
            window.iniciarApp();
        } else { 
            throw new Error("Usuário inativo ou não encontrado no sistema."); 
        }
    } catch(e) { 
        if (erro) {
            erro.innerText = "Acesso negado: " + e.message; 
            erro.classList.remove('hidden'); 
        } else {
            alert("Acesso negado: " + e.message);
        }
    } finally {
        window.toggleButtonLoading(btnLogin, false);
    }
};

window.logout = function() { 
    localStorage.removeItem("caatinga_user"); 
    signOut(auth).then(() => { location.reload(); });
};

window.iniciarApp = function() {
    window.tenant = String(window.USUARIO.empresa_id || "global").toLowerCase().trim();
    
    // Configura os caminhos dinâmicos das coleções baseadas no Tenant
    window.PATHS = {
        veiculos: `${window.tenant}_veiculos`,
        abastecimentos: `${window.tenant}_abastecimentos`,
        manutencoes: `${window.tenant}_os`,
        equipe: `${window.tenant}_equipe`,
        config: `${window.tenant}_config`,
        rdvs: `${window.tenant}_rdv`
    };

    let n = String(window.USUARIO.nivel_acesso || '').toUpperCase();
    let s = String(window.USUARIO.setor || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Definição de Perfis (Roles)
    let moduloRole = "Motorista"; 
    if(n === 'SUPER_ADM' || n === 'ADM') moduloRole = "ADM";
    else if(s.includes('GERENTE') && s.includes('POSTO')) moduloRole = "GerentePosto"; 
    else if(s.includes('POSTO') || s.includes('FRENTISTA')) moduloRole = "Frentista";
    else if(s.includes('TRANSPORTE')) moduloRole = "GestorTransporte";
    else if(s.includes('ABASTECIMENTO')) moduloRole = "GestorAbastecimento";
    else if(s.includes('RETROATIVO')) moduloRole = "LancadorRetroativo";

    window.USUARIO.moduloRole = moduloRole; 

    // Atualização segura do DOM (Proteção caso o elemento não exista na tela)
    let viewLogin = document.getElementById('viewLogin');
    let appView = document.getElementById('app');
    if (viewLogin) viewLogin.classList.add('hidden');
    if (appView) appView.classList.remove('hidden');
    
    let txtUser = document.getElementById('txtUser');
    if(txtUser) txtUser.innerHTML = `<i class="fas fa-user-circle"></i> ${window.USUARIO.nome}`;
    
    let txtNivel = document.getElementById('txtNivel');
    if(txtNivel) txtNivel.innerText = moduloRole;
    
    let txtTenant = document.getElementById('txtTenant');
    if(txtTenant) txtTenant.innerText = window.tenant.toUpperCase();
    
    let badgeTenant = document.getElementById("tenant-display-badge");
    if(badgeTenant) badgeTenant.innerText = window.tenant;

    // Inicia a carga de dados global
    if (window.buscarTudo) window.buscarTudo();
};

window.rotearTelas = function() {
    // 1. Oculta todas as views principais de forma segura
    ['viewADM','viewFrentista','viewGestorTransp','viewGestorAbast', 'viewRetroativo'].forEach(i => {
        let el = document.getElementById(i);
        if(el) el.classList.add('hidden');
    }); 
    
    // 2. Oculta abas específicas
    ['btnExtraPosto', 'navAbaFrentEmitidas', 'navAbaFrentExtras'].forEach(i => {
        let el = document.getElementById(i);
        if(el) el.classList.add('hidden');
    });

    // 3. Exibe a tela correspondente ao papel do usuário
    const r = window.USUARIO.moduloRole;
    
    if(r === 'ADM') { 
        let view = document.getElementById('viewADM'); if(view) view.classList.remove('hidden'); 
        if(window.filtrarRelatorio) window.filtrarRelatorio(); 
    }
    else if(r === 'Frentista') { 
        let view = document.getElementById('viewFrentista'); if(view) view.classList.remove('hidden'); 
        if(window.renderFilaPosto) window.renderFilaPosto(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas();
    }
    else if(r === 'GerentePosto') { 
        let view = document.getElementById('viewFrentista'); if(view) view.classList.remove('hidden'); 
        let btnExtra = document.getElementById('btnExtraPosto'); if(btnExtra) btnExtra.classList.remove('hidden');
        let navEmitidas = document.getElementById('navAbaFrentEmitidas'); if(navEmitidas) navEmitidas.classList.remove('hidden'); 
        let navExtras = document.getElementById('navAbaFrentExtras'); if(navExtras) navExtras.classList.remove('hidden');
        
        if(window.renderFilaPosto) window.renderFilaPosto(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas(); 
        if(window.renderRelatorioExtrasPosto) window.renderRelatorioExtrasPosto();
    }
    else if(r === 'GestorTransporte') { 
        let view = document.getElementById('viewGestorTransp'); if(view) view.classList.remove('hidden'); 
        if(window.renderPainelTransporte) window.renderPainelTransporte(); 
    }
    else if(r === 'GestorAbastecimento') { 
        let view = document.getElementById('viewGestorAbast'); if(view) view.classList.remove('hidden'); 
        if(window.renderPainelAbastecimento) window.renderPainelAbastecimento(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas();
    }
    else if(r === 'LancadorRetroativo') {
        let view = document.getElementById('viewRetroativo'); if(view) view.classList.remove('hidden'); 
        if(window.renderPainelRetroativo) window.renderPainelRetroativo();
    }
};