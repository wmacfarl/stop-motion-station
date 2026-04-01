export default function mountNodeIntoContainer(containerElement, persistentNode) {
  if (!containerElement || !persistentNode) {
    return;
  }

  if (containerElement.firstChild === persistentNode) {
    return;
  }

  containerElement.innerHTML = "";
  containerElement.appendChild(persistentNode);
}
