'use strict';

/**
 * @ngdoc function
 * @name nosProductsApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the nosProductsApp
 */
angular.module('nosProductsApp')
    .controller('MainCtrl', function ($scope, esriLoader, $log, $http) {
        $scope.bbox = null;
        $scope.formatSelect = null;
        $scope.survey = null;

        //$scope.dateInput = new Date(2015,0,1);

        $scope.resetForm = function() {
            $scope.dateInput = null;
            $scope.formatSelect = null;
            $scope.bbox = null;
            $scope.selectedGeom = null;
            $scope.survey = null;
            $scope.clearGraphics();
            $scope.results = null;
            $scope.message = null;
        };


        $scope.updateResults = function() {
          var params = {};
          if ($scope.formatSelect) {
              params.format = $scope.formatSelect;
          }

          if ($scope.dateInput) {
              var year = $scope.dateInput.getFullYear();
              var month = $scope.dateInput.getMonth() + 1;
              var day = $scope.dateInput.getDate();
              params.date = year+'-'+month+'-'+day;
          }
          if ($scope.bbox) {
              params.bbox = $scope.bbox;
          }

          if ($scope.survey) {
              params.survey = $scope.survey;
          }
          $log.log(params);

          $scope.message = "retrieving products. Please wait...";
          $scope.results = null;

          $http.get('http://maps.ngdc.noaa.gov/mapviewer-support/hydro/products.groovy', {
              params: params
          }).success(function(data) {
              $scope.message = "found " + data.items.length+" products.";
              if (data.items.length > 100) {
                  $scope.message += "This is too many to display on the page. Please adjust the search criteria and try again.";
              } else {
                  $scope.results = data.items;
              }

          }).error(function(data,status){
              $log.log('Error retrieving data:');
              $log.log(data);
              $log.log('status: ',status);
          });
        };

        //$log.log('loading product format list...');
        $http.get('http://maps.ngdc.noaa.gov/mapviewer-support/hydro/formats.groovy').success(function(data) {
            $scope.formats = data.items;
        });

        //setup typeahead
        $(document).ready(function() {
            //TODO prefetch limited set of surveys, perhaps based on date; configure remote URL for rest
            var surveys = new Bloodhound({
                datumTokenizer: Bloodhound.tokenizers.whitespace,
                queryTokenizer: Bloodhound.tokenizers.whitespace,
                prefetch: 'https://maps.ngdc.noaa.gov/mapviewer-support/hydro/surveys.groovy'
            });

            // passing in `null` for the `options` arguments will result in the default options being used
            $('.typeahead').typeahead(null, {
                name: 'surveys',
                source: surveys
            });

            $('.typeahead').bind('typeahead:select', function(ev, suggestion) {
                $scope.survey = suggestion;
            });
        });

        var map = {
            options: {
                basemap: 'oceans',
                center: [-102,38],
                zoom: 3,
                sliderStyle: 'small'
            }
        };
        $scope.map = map;

        // start once the map is loaded
        $scope.onMapLoad = function (map) {

            // requires other Esri modules (graphics, symbols, and toolbars) so load them up front using esriLoader
            esriLoader.require([
                'esri/toolbars/draw',
                'esri/symbols/SimpleLineSymbol',
                'esri/symbols/SimpleFillSymbol',
                'esri/graphic',
                'esri/Color',
                'esri/geometry/webMercatorUtils'
            ], function (Draw,
                         SimpleLineSymbol,
                         SimpleFillSymbol,
                         Graphic,
                         Color,
                         webMercatorUtils) {

                var tb;

                var fillSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT,
                        new Color([255, 0, 0]), 2), new Color([255, 255, 0, 0.25])
                );

                // get a local reference to the map object once it's loaded
                // and initialize the drawing toolbar
                function initToolbar(mapObj) {
                    map = mapObj;
                    tb = new Draw(map);
                    tb.on('draw-end', function (e) {
                        $scope.$apply(function () {
                            $scope.selectedGeom = webMercatorUtils.webMercatorToGeographic(e.geometry);
                            $scope.bbox = $scope.selectedGeom.xmin.toFixed(3)+','+
                                          $scope.selectedGeom.ymin.toFixed(3)+','+
                                          $scope.selectedGeom.xmax.toFixed(3)+','+
                                          $scope.selectedGeom.ymax.toFixed(3);
                            addGraphic(e);
                        });
                    });

                    // set the active tool once a button is clicked
                    // apply this function binding to scope since it is outside of the digest cycle
                    $scope.$apply(function () {
                        $scope.activateDrawTool = activateDrawTool;
                        $scope.clearGraphics = clearGraphics;
                    });
                }

                function clearGraphics() {
                    map.graphics.clear();
                }


                function activateDrawTool(tool) {
                    map.disableMapNavigation();
                    tb.activate(tool.toLowerCase());

                    //clear any existing graphics
                    clearGraphics();
                }


                function addGraphic(evt) {
                    //deactivate the toolbar
                    tb.deactivate();
                    map.enableMapNavigation();

                    var symbol = fillSymbol;

                    map.graphics.add(new Graphic(evt.geometry, symbol));
                }


                // bind the toolbar to the map
                initToolbar(map);

                //TODO set timeout such that position update doesn't happen too frequently
                map.on('mouse-move', function (e) {
                    $scope.$apply(function () {
                        $scope.mouseposition = webMercatorUtils.webMercatorToGeographic(e.mapPoint);
                    });
                });

            });

        };


    });
