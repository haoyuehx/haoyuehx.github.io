(function () {
  var typeLabelMap = {
    note: 'NOTE',
    tip: 'TIP',
    info: 'INFO',
    important: 'IMPORTANT',
    warning: 'WARNING',
    caution: 'CAUTION',
    danger: 'DANGER'
  };

  function upgradeCallouts(root) {
    var blockquotes = root.querySelectorAll('.main-content blockquote');
    blockquotes.forEach(function (blockquote) {
      var firstParagraph = blockquote.firstElementChild;
      if (!firstParagraph || firstParagraph.tagName.toLowerCase() !== 'p') {
        return;
      }

      var text = firstParagraph.textContent || '';
      var matched = text.match(/^\s*\[!([A-Za-z]+)\]\s*/);
      if (!matched) {
        return;
      }

      var rawType = matched[1].toLowerCase();
      var type = typeLabelMap[rawType] ? rawType : 'note';
      var markerPattern = /^\s*\[![A-Za-z]+\]\s*/;

      firstParagraph.innerHTML = firstParagraph.innerHTML.replace(markerPattern, '');

      blockquote.classList.add('md-callout', 'md-callout-' + type);

      var title = document.createElement('div');
      title.className = 'md-callout-title';
      title.textContent = typeLabelMap[type];
      blockquote.insertBefore(title, blockquote.firstChild);

      if (firstParagraph.textContent.trim() === '' && firstParagraph.children.length === 0) {
        firstParagraph.remove();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      upgradeCallouts(document);
    });
  } else {
    upgradeCallouts(document);
  }
})();
