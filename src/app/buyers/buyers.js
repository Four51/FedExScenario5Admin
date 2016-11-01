angular.module( 'orderCloud' )

    .config( BuyerConfig )
    .controller( 'BuyerCtrl', BuyerController )
    .controller( 'BuyerEditCtrl', BuyerEditController )
    .controller( 'BuyerCreateCtrl', BuyerCreateController )
    .factory('BuyerService', BuyerService)

;

function BuyerConfig( $stateProvider ) {
    $stateProvider
        .state( 'buyers', {
            parent: 'base',
            url: '/buyers',
            templateUrl: 'buyers/templates/buyers.tpl.html',
            controller: 'BuyerCtrl',
            controllerAs: 'buyers',
            data: { componentName: 'Buyers' },
            resolve: {
                BuyerList: function(Buyers) {
                    return Buyers.List();
                }
            }
        })
        .state( 'buyers.edit', {
            url: '/:buyerid/edit',
            templateUrl: 'buyers/templates/buyerEdit.tpl.html',
            controller: 'BuyerEditCtrl',
            controllerAs: 'buyerEdit',
            resolve: {
                SelectedBuyer: function($stateParams, Buyers) {
                    return Buyers.Get($stateParams.buyerid);
                }
            }
        })
        .state( 'buyers.create', {
            url: '/create',
            templateUrl: 'buyers/templates/buyerCreate.tpl.html',
            controller: 'BuyerCreateCtrl',
            controllerAs: 'buyerCreate'
        });
}

function BuyerService(Buyers, $q, Underscore, OrderCloud) {
    var service = {
        GetAllBuyers: _getAllBuyers,
        GetAllProductsByBuyer: _getAllProductsByBuyer,
        SearchBuyers: _searchBuyers,
        LimitBuyers: _limitBuyers
    };

    function _getAllBuyers() {
        var deferred = $q.defer();
        Buyers.List()
            .then(function(data) {
                deferred.resolve(data.Items);
            });
        return deferred.promise;
    }

    function _getAllProductsByBuyer(buyers, products) {
        var result = {};
        angular.forEach(buyers, function(buyer) {
            result[buyer.ID] = Underscore.filter(products, function(prod){return prod.xp && prod.xp.BuyerID == buyer.ID;})
        });
        return result;
    }

    function _searchBuyers(buyers, searchVal) {
        searchVal = searchVal.toLowerCase();
        var buyerNames = Underscore.pluck(buyers, "Name");
        var buyersClean = [];
        buyerNames.forEach(function(e) {
            buyersClean.push(" " + e.toLowerCase() + " ");
        });
        searchVal = searchVal.replace(",", "");
        var searchArray = searchVal.split(" ");
        var returnArray = [];
        var pts = 0;
        var count = 0;
        buyersClean.forEach(function(each) {
            var oneMatch = false;
            if (each.indexOf(searchVal) > -1 && searchArray.length > 1) {
                pts += searchArray.length * 2;
            } else {
                searchArray.forEach(function(e) {
                    if (each.indexOf(" " + e + " ") > -1) {
                        pts = oneMatch ? 2 : 1;
                        oneMatch = true;

                    } else if (each.indexOf(e) > -1) {
                        pts += 0.65;
                    }
                })
            }
            if (pts > 0) {
                buyers[count].score = pts;
                returnArray.push(buyers[count]);
            }
            count++;
            pts = 0;
        });
        return Underscore.chain(returnArray).sortBy(function(o) {return (-1 * o.score);}).value().slice(0,10);
    }

    function _limitBuyers() {
        var deferred = $q.defer();
        OrderCloud.Me.Get()
            .then(function(data) {
                if (data.xp.Buyers) {
                    deferred.resolve(data.xp.Buyers);
                } else {
                    deferred.resolve();
                }
            });
        return deferred.promise;
    }


    return service;
}

function BuyerController(BuyerList) {
    var vm = this;
    vm.list = BuyerList;
}

function BuyerEditController($exceptionHandler, $state, SelectedBuyer, Buyers) {
    var vm = this;
    vm.buyer = SelectedBuyer;
    vm.buyerName = SelectedBuyer.Name;

    vm.Submit = function() {
        Buyers.Update(vm.buyer)
            .then(function() {
                $state.go('buyers', {}, {reload:true});
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
            });
    }
}

function BuyerCreateController($exceptionHandler, $state, Buyers) {
    var vm = this;

    vm.Submit = function () {
        Buyers.Create(vm.buyer)
            .then(function() {
                $state.go('buyers', {}, {reload:true});
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
            });
    }
}
