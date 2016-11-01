angular.module( 'orderCloud' )

    .config( SpecsConfig )
    .controller( 'SpecsCtrl', SpecsController )
    .controller( 'SpecEditCtrl', SpecEditController )
    .controller( 'SpecCreateCtrl', SpecCreateController )
    .controller( 'SpecAssignCtrl', SpecAssignController )
    .factory( 'SpecService', SpecService )

;

function SpecsConfig( $stateProvider ) {
    $stateProvider
        .state( 'specs', {
            parent: 'base',
            url: '/specs',
            templateUrl:'specs/templates/specs.tpl.html',
            controller:'SpecsCtrl',
            controllerAs: 'specs',
            data: {componentName: 'Specs'},
            resolve: {
                SpecList: function(OrderCloud) {
                    return OrderCloud.Specs.List();
                }
            }
        })
        .state( 'specs.edit', {
            url: '/:specid/edit',
            templateUrl:'specs/templates/specEdit.tpl.html',
            controller:'SpecEditCtrl',
            controllerAs: 'specEdit',
            resolve: {
                SelectedSpec: function($stateParams, OrderCloud) {
                    return OrderCloud.Specs.Get($stateParams.specid);
                }
            }
        })
        .state( 'specs.create', {
            url: '/create',
            templateUrl:'specs/templates/specCreate.tpl.html',
            controller:'SpecCreateCtrl',
            controllerAs: 'specCreate'
        })
        .state('specs.assign', {
            url: '/:specid/assign',
            templateUrl: 'specs/templates/specAssign.tpl.html',
            controller: 'SpecAssignCtrl',
            controllerAs: 'specAssign',
            resolve: {
                ProductList: function (OrderCloud) {
                    return OrderCloud.Products.List(null, 1, 20);
                },
                ProductAssignments: function ($stateParams, OrderCloud) {
                    return OrderCloud.Specs.ListProductAssignments($stateParams.specid);
                },
                SelectedSpec: function ($stateParams, OrderCloud) {
                    return OrderCloud.Specs.Get($stateParams.specid);
                }
            }
        })
}

function SpecService(OrderCloud, $q) {
    var service = {
        GetAllSpecs: _getAllSpecs,
        GetAssignedSpecs: _getAssignedSpecs
    };
    function _getAllSpecs() {
        var deferred = $q.defer();
        OrderCloud.Specs.List()
            .then(function(data) {
                console.log(data.Items);
                deferred.resolve(data.Items);
            });
        return deferred.promise;
    }

    function _getAssignedSpecs(productid) {
        var deferred = $q.defer();
        OrderCloud.Specs.ListProductAssignments(null, productid)
            .then(function(data) {
                deferred.resolve(data.Items);
            });
        return deferred.promise;
    }

    return service;
}

function SpecsController( SpecList ) {
    var vm = this;
    vm.list = SpecList;
}

function SpecEditController( $exceptionHandler, $state, OrderCloud, SelectedSpec ) {
    var vm = this,
        specid = angular.copy(SelectedSpec.ID);
    vm.specName = angular.copy(SelectedSpec.Name);
    vm.spec = SelectedSpec;
    vm.Option = {};
    vm.Options = vm.spec.Options;

    vm.addSpecOpt = function() {
        if (vm.DefaultOptionID) {
            vm.spec.DefaultOptionID = vm.Option.ID;
        }
        OrderCloud.Specs.CreateOption(specid, vm.Option)
            .then(function() {
                    vm.Option = null;
                })
            };

    vm.deleteSpecOpt = function($index) {
        if (vm.spec.DefaultOptionID == vm.spec.Options[$index].ID) {
            vm.spec.DefaultOptionID = null;
        }
        vm.Options.splice($index, 1);
        OrderCloud.Specs.DeleteOption(specid, vm.spec.Options[$index].ID)
    };

    vm.Submit = function() {
        OrderCloud.Specs.Update(specid, vm.spec)
            .then(function() {
                $state.go('specs', {}, {reload:true})
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    };

    vm.Delete = function() {
        OrderCloud.Specs.Delete(specid)
            .then(function() {
                $state.go('specs', {}, {reload:true})
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    }
}

function SpecCreateController( $exceptionHandler, $q, $state, OrderCloud) {
    var vm = this;
    vm.spec = {};
    vm.Options = [];
    var DefaultOptionID;

    vm.addSpecOpt = function() {
        vm.Options.push(vm.Option);
        if (vm.DefaultOptionID) {
            DefaultOptionID = vm.Option.ID;
        }
        vm.Option = null;
        vm.DefaultOptionID = null;
    };

    vm.deleteSpecOpt = function($index) {
        if (vm.spec.DefaultOptionID == vm.Options[$index].ID) {
            vm.spec.DefaultOptionID = null;
        }
        vm.Options.splice($index, 1);
    };

    vm.Submit = function() {
        OrderCloud.Specs.Create(vm.spec)
            .then(function(spec) {
                var queue = [],
                    dfd = $q.defer();
                angular.forEach(vm.Options, function(opt) {
                    queue.push(OrderCloud.Specs.CreateOption(spec.ID, opt));
                });
                $q.all(queue).then(function() {
                    dfd.resolve();
                    if(DefaultOptionID != null){
                        OrderCloud.Specs.Patch(spec.ID, {DefaultOptionID: DefaultOptionID})
                    }
                    $state.go('specs', {}, {reload: true});
                });
                return dfd.promise;
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    }
}
function SpecAssignController(OrderCloud, Assignments, Paging, ProductList, ProductAssignments, SelectedSpec) {
    var vm = this;
    vm.Spec = SelectedSpec;
    vm.list = ProductList;
    vm.assignments = ProductAssignments;
    vm.saveAssignments = SaveAssignment;
    vm.pagingfunction = PagingFunction;

    function SaveFunc(ItemID) {
        return OrderCloud.Specs.SaveProductAssignment({
            SpecID: vm.Spec.ID,
            ProductID: ItemID
        });
    }

    function DeleteFunc(ItemID) {
        return OrderCloud.Specs.DeleteProductAssignment(vm.Spec.ID, ItemID);
    }

    function SaveAssignment() {
        return Assignments.saveAssignments(vm.list.Items, vm.assignments.Items, SaveFunc, DeleteFunc, 'ProductID');
    }

    function AssignmentFunc() {
        return OrderCloud.Specs.ListProductAssignments(vm.Spec.ID, null, vm.assignments.Meta.PageSize);
    }

    function PagingFunction() {
        return Paging.paging(vm.list, 'Products', vm.assignments, AssignmentFunc);
    }
}
