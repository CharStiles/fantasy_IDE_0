function createMovingIframes() {
  const directions = [
    { x: -1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 }
  ];

  let activeIframe = null;
  let animationFrames = [];
  let transitionEnabled = false;
  let containers = [];
  let animationState = 0; // 0: Still, 1: Animated with ease, 2: Animated without ease

  function createIframe(index) {
    const dir = directions[index % directions.length];
    const container = document.createElement('div');
    container.id = `item-${index}`;
    container.style.position = 'absolute';
    container.style.overflow = 'hidden';
    container.style.width = '200px';
    container.style.height = '150px';
    container.style.transition = transitionEnabled ? 'all 0.3s ease-in-out' : '';

    const iframe = document.createElement('iframe');
    iframe.src = `editor?shader=${index}`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.pointerEvents = 'none'; // Disable pointer events on iframe

    iframe.addEventListener('load', () => {
      iframe.contentWindow.postMessage({ type: 'setup' }, '*');
    });

    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.cursor = 'pointer';

    container.appendChild(iframe);
    container.appendChild(overlay);

    const itemDiv = document.createElement('div');
    itemDiv.className = 'item';
    itemDiv.setAttribute('data-toggle', 'tooltip');
    itemDiv.setAttribute('data-html', 'true');
    itemDiv.setAttribute('data-original-title', '<em>mathclub.html</em>');

    itemDiv.appendChild(container);
    document.body.appendChild(itemDiv);

    // Set initial random position
    let x = Math.random() * (window.innerWidth - 200);
    let y = Math.random() * (window.innerHeight - 150);
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;

    // Start animation based on current state
    if (animationState !== 0) {
      startAnimation(container, index);
    }

    // Movement function
    function move() {
      if (activeIframe === container) return;
      let speed = 0.05;
      x += dir.x * (1 + index * speed);
      y += dir.y * (1 + index * speed);

      // Bounce off edges
      if (x <= 0 || x >= window.innerWidth - 200) dir.x *= -1;
      if (y <= 0 || y >= window.innerHeight - 150) dir.y *= -1;

      container.style.left = `${x}px`;
      container.style.top = `${y}px`;

      animationFrames[index] = requestAnimationFrame(move);
    }

    move();

    // Click event to expand iframe
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeIframe !== container) {
        expandIframe(container);
      }
    });

    containers.push(container);
  }

  // Initially create 4 iframes
  for (let i = 0; i < 4; i++) {
    createIframe(i);
  }

  function expandIframe(container) {
    if (activeIframe) return;
    activeIframe = container;
    
    const index = containers.indexOf(container);
    cancelAnimationFrame(animationFrames[index]);
    
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1000';
    container.style.transition = transitionEnabled ? 'all 0.3s ease-in-out' : '';
    
    const iframe = container.querySelector('iframe');
    const overlay = container.querySelector('div');
    
    setTimeout(() => {
      iframe.style.pointerEvents = 'auto';
      overlay.style.display = 'none';
      
      // Reload the iframe
      iframe.src = iframe.src;

      // Add event listener to capture key events from the iframe
      window.addEventListener('message', handleIframeKeyEvents);
    }, transitionEnabled ? 300 : 0);
  }

  function resetIframe() {
    if (activeIframe) {
      const index = containers.indexOf(activeIframe);
      if (index !== -1) {
        // Cancel the existing animation frame
        cancelAnimationFrame(animationFrames[index]);
        
        activeIframe.style.position = 'absolute';
        activeIframe.style.width = '200px';
        activeIframe.style.height = '150px';
        activeIframe.style.zIndex = '';
        activeIframe.style.transition = transitionEnabled ? 'all 0.3s ease-in-out' : '';
        
        const iframe = activeIframe.querySelector('iframe');
        iframe.style.pointerEvents = 'none'; // Disable pointer events again
        iframe.contentWindow.postMessage({ type: 'reset' }, '*');
        
        const overlay = activeIframe.querySelector('div');
        overlay.style.display = 'block'; // Show overlay again
        
        // Restart the animation
        const dir = directions[index % directions.length];
        let x = parseFloat(activeIframe.style.left);
        let y = parseFloat(activeIframe.style.top);
        
        function move() {
          let speed = 0.05;
          x += dir.x * (1 + index * speed);
          y += dir.y * (1 + index * speed);

          // Bounce off edges
          if (x <= 0 || x >= window.innerWidth - 200) dir.x *= -1;
          if (y <= 0 || y >= window.innerHeight - 150) dir.y *= -1;

          containers[index].style.left = `${x}px`;
          containers[index].style.top = `${y}px`;

          animationFrames[index] = requestAnimationFrame(move);
        }

        move();
      }
      
      activeIframe = null;
      
      // Restart animation based on current state
      if (animationState !== 0) {
        startAnimation(containers[index], index);
      }
    }
  }

  // New function to handle key events from the iframe
  function handleIframeKeyEvents(event) {
    if (event.data.type === 'keydown') {
      // Simulate the key event on the main document
      const keyEvent = new KeyboardEvent('keydown', {
        key: event.data.key,
        keyCode: event.data.keyCode,
        which: event.data.which,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(keyEvent);
    }
  }

  // Event listener for messages from iframes
  window.addEventListener('message', (event) => {
    if (event.data.type === 'escape') {
      resetIframe();
    }
  });

  // Event listener for key presses
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      resetIframe();
    } else if (e.key === '1') {
      animationState = (animationState + 1) % 3;
      updateAnimationState();
    } else if (e.key === '2') {
      createIframe(containers.length);
    } else if (e.key === '3' && containers.length > 1) {
      const lastContainer = containers.pop();
      lastContainer.remove();
      cancelAnimationFrame(animationFrames[containers.length]);
    }
  });

  // Click outside to reset
  document.addEventListener('click', (e) => {
    if (activeIframe && !activeIframe.contains(e.target)) {
      resetIframe();
    }
  });

  // Add this new function to update the animation state
  function updateAnimationState() {
    containers.forEach((container, index) => {
      if (container === activeIframe) return; // Skip the active (expanded) iframe

      container.style.transition = animationState === 1 ? 'all 0.3s ease-in-out' : '';

      if (animationState === 0) {
        // Still
        cancelAnimationFrame(animationFrames[index]);
      } else {
        // Animated (with or without ease)
        startAnimation(container, index);
      }
    });
  }

  // Add this new function to start the animation for a container
  function startAnimation(container, index) {
    cancelAnimationFrame(animationFrames[index]); // Cancel any existing animation

    if (animationState === 0) return; // Don't start animation if state is 0

    const dir = directions[index % directions.length];
    let x = parseFloat(container.style.left);
    let y = parseFloat(container.style.top);

    function move() {
      if (animationState === 0 || container === activeIframe) {
        cancelAnimationFrame(animationFrames[index]);
        return;
      }
      let speed = 0.05;
      x += dir.x * (1 + index * speed);
      y += dir.y * (1 + index * speed);

      // Bounce off edges
      if (x <= 0 || x >= window.innerWidth - 200) dir.x *= -1;
      if (y <= 0 || y >= window.innerHeight - 150) dir.y *= -1;

      container.style.left = `${x}px`;
      container.style.top = `${y}px`;

      animationFrames[index] = requestAnimationFrame(move);
    }

    move();
  }

  // Call this at the end of createMovingIframes to set initial state
  updateAnimationState();
}

// Call this function when you want to create the moving iframes
createMovingIframes();
