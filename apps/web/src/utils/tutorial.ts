import Shepherd from 'shepherd.js';

let activeTour: any = null;

/**
 * Inicia o Tutorial Interativo Guiado (Onboarding Tour) para o Aluno
 * utilizando Shepherd.js com tema visual escuro integrado ao Webboard.
 */
export function startStudentTour(force = false): void {
  if (typeof window === 'undefined') return;

  const TOUR_STORAGE_KEY = 'webboard_student_tour_completed';
  if (!force && localStorage.getItem(TOUR_STORAGE_KEY) === 'true') {
    return;
  }

  if (activeTour) {
    activeTour.cancel();
  }

  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: {
        enabled: true
      },
      classes: 'shepherd-theme-webboard',
      scrollTo: { behavior: 'smooth', block: 'center' }
    }
  });

  // Passo 1: Boas-vindas à Bancada
  tour.addStep({
    id: 'welcome',
    title: '⚡ Bem-vindo ao Webboard!',
    text: 'Esta é a sua bancada interativa de prototipagem e robótica com Arduino Uno. Vamos fazer um tour rápido de 30 segundos pelos controles principais!',
    buttons: [
      {
        text: 'Pular Tour',
        action: () => {
          localStorage.setItem(TOUR_STORAGE_KEY, 'true');
          tour.complete();
        }
      },
      {
        text: 'Começar →',
        classes: 'shepherd-button-primary',
        action: tour.next
      }
    ]
  });

  // Passo 2: Catálogo de Componentes
  tour.addStep({
    id: 'catalog',
    attachTo: {
      element: '#tour-catalog',
      on: 'right'
    },
    title: '📦 Catálogo de Componentes',
    text: 'Aqui você encontra protoboards, LEDs, resistores com código de cores, botões e sensores. Clique ou arraste os componentes para posicioná-los na bancada.',
    buttons: [
      {
        text: 'Voltar',
        action: tour.back
      },
      {
        text: 'Próximo →',
        classes: 'shepherd-button-primary',
        action: tour.next
      }
    ]
  });

  // Passo 3: Paleta de Cores de Fios
  tour.addStep({
    id: 'wire-colors',
    attachTo: {
      element: '#tour-wire-colors',
      on: 'bottom'
    },
    title: '🎨 Conexões e Cores de Fios',
    text: 'Selecione a cor do condutor antes de ligar os pinos. Use Vermelho para 5V, Preto para GND e outras cores para sinais digitais e analógicos.',
    buttons: [
      {
        text: 'Voltar',
        action: tour.back
      },
      {
        text: 'Próximo →',
        classes: 'shepherd-button-primary',
        action: tour.next
      }
    ]
  });

  // Passo 4: Energização da Bancada
  tour.addStep({
    id: 'simulation',
    attachTo: {
      element: '#tour-simulation-control',
      on: 'bottom'
    },
    title: '⚡ Energizar Bancada',
    text: 'Clique aqui para compilar seu código C++ no microcontrolador ATmega328P e energizar a bancada. Se houver algum curto-circuito, o simulador avisa e protege os componentes!',
    buttons: [
      {
        text: 'Voltar',
        action: tour.back
      },
      {
        text: 'Próximo →',
        classes: 'shepherd-button-primary',
        action: tour.next
      }
    ]
  });

  // Passo 5: Código & Serial
  tour.addStep({
    id: 'code-panel',
    attachTo: {
      element: '#tour-code-panel',
      on: 'left'
    },
    title: '💻 Código Arduino & Monitor Serial',
    text: 'Abra este painel para programar seu sketch Arduino com autocomplete inteligente (IntelliSense) ou acompanhar as mensagens do Monitor Serial.',
    buttons: [
      {
        text: 'Voltar',
        action: tour.back
      },
      {
        text: 'Próximo →',
        classes: 'shepherd-button-primary',
        action: tour.next
      }
    ]
  });

  // Passo 6: Ações de Nuvem e Conclusão
  tour.addStep({
    id: 'actions',
    attachTo: {
      element: '#tour-actions',
      on: 'bottom'
    },
    title: '🚀 Salvar e Submeter Desafio',
    text: 'Tudo pronto! Salve sua bancada na nuvem a qualquer momento ou submeta o desafio ativo para auto-avaliação do professor. Bom projeto!',
    buttons: [
      {
        text: 'Concluir Tutorial ✨',
        classes: 'shepherd-button-primary',
        action: () => {
          localStorage.setItem(TOUR_STORAGE_KEY, 'true');
          tour.complete();
        }
      }
    ]
  });

  tour.on('complete', () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    activeTour = null;
  });

  tour.on('cancel', () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    activeTour = null;
  });

  activeTour = tour;
  tour.start();
}
