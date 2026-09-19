// Solution working for a multiple buttons checked at a time
// https://codepen.io/desandro/pen/JGKyrY
//
var $blogposts = $('#blogposts');
$blogposts.isotope({itemSelector : '.col'});
var $checkboxes = $('#filters input');

$checkboxes.change( function() {
    var all = document.getElementById('js-iso-all');
    if (all) {
      if (this === all) {
        if (all.checked) $checkboxes.not(all).prop('checked', false);
      } else if (this.checked) {
        all.checked = false;
      } else if (!$checkboxes.not(all).is(':checked')) {
        all.checked = true;
      }
    }
    var inclusives = [];
    $checkboxes.each( function( i, elem ) {
      if ( elem.checked ) {
        inclusives.push( elem.getAttribute('data-filter') );
      }
    });
    var filterValue = inclusives.length ? inclusives.join(', ') : '*';
    $blogposts.isotope({ filter: filterValue })
});

// Solution working for a single button checked at a time
// https://codepen.io/desandro/pen/lxzDA
//
// var $blogposts = $('#blogposts'); 
// $blogposts.isotope({
//   itemSelector : '.col'
// }); 
// $('#filters').on( 'click', 'button', function() {
//     var selector = $(this).attr('data-filter');
//     $blogposts.isotope({ filter: selector });
//     return false;
// });
// $('.button-group').each( function( i, buttonGroup ) {
//     var $buttonGroup = $( buttonGroup );
//     $buttonGroup.on( 'click', 'button', function() {
//       $buttonGroup.find('.is-checked').removeClass('is-checked');
//       $( this ).addClass('is-checked');
//     });
// });
