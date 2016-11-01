angular.module( 'orderCloud' )

    .config( AdminUsersConfig )
    .controller( 'AdminUsersCtrl', AdminUsersController )
    .controller( 'AdminUserEditCtrl', AdminUserEditController )
    .controller( 'AdminUserCreateCtrl', AdminUserCreateController )
    .factory( 'AdminUserService', AdminUserService )

;

function AdminUsersConfig( $stateProvider ) {
    $stateProvider
        .state( 'adminUsers', {
            parent: 'base',
            url: '/adminUsers',
            templateUrl:'adminUsers/templates/adminUsers.tpl.html',
            controller:'AdminUsersCtrl',
            controllerAs: 'adminUsers',
            data: {
                componentName: 'Admin Users'
            },
            resolve: {
                AdminUsersList: function(OrderCloud) {
                    return OrderCloud.AdminUsers.List();
                }
            }
        })
        .state( 'adminUsers.edit', {
            url: '/:adminuserid/edit',
            templateUrl:'adminUsers/templates/adminUserEdit.tpl.html',
            controller:'AdminUserEditCtrl',
            controllerAs: 'adminUserEdit',
            resolve: {
                SelectedAdminUser: function($stateParams, OrderCloud) {
                    return OrderCloud.AdminUsers.Get($stateParams.adminuserid);
                }
            }
        })
        .state( 'adminUsers.create', {
            url: '/create',
            templateUrl:'adminUsers/templates/adminUserCreate.tpl.html',
            controller:'AdminUserCreateCtrl',
            controllerAs: 'adminUserCreate'
        })
}

function AdminUserService(OrderCloud, $q) {
    var service = {
        GetAllSuppliers: _getAllSuppliers
    }

    function _getAllSuppliers() {
        var deferred = $q.defer();
        OrderCloud.AdminUsers.List(null, 1, 100, null, null, {"xp.UserType": "Supplier"})
            .then(function(data) {
                deferred.resolve(data.Items);
            });
        return deferred.promise;
    }

    return service;
}

function AdminUsersController( AdminUsersList, TrackSearch ) {
    var vm = this;
    vm.list = AdminUsersList;
    vm.searching = function() {
        return TrackSearch.GetTerm() ? true : false;
    };
}

function AdminUserEditController( $exceptionHandler, $state, OrderCloud, SelectedAdminUser ) {
    var vm = this,
        adminuserid = SelectedAdminUser.ID;
    vm.adminUserName = SelectedAdminUser.Username;
    vm.adminUser = SelectedAdminUser;
    if(vm.adminUser.TermsAccepted != null) {
        vm.TermsAccepted = true;
    }

    vm.Submit = function() {
        OrderCloud.AdminUsers.Update(adminuserid, vm.adminUser)
            .then(function() {
                $state.go('adminUsers', {}, {reload:true})
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    };

    vm.Delete = function() {
        OrderCloud.AdminUsers.Delete(adminuserid)
            .then(function() {
                $state.go('adminUsers', {}, {reload:true})
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    }
}

function AdminUserCreateController( $exceptionHandler, $state, OrderCloud ) {
    var vm = this;
    vm.adminUser = {Email:"", Password:""};
    vm.Submit = function() {
        var today = new Date();
        vm.adminUser.TermsAccepted = today;
        OrderCloud.AdminUsers.Create( vm.adminUser)
            .then(function() {
                $state.go('adminUsers', {}, {reload:true})
            })
            .catch(function(ex) {
                $exceptionHandler(ex)
            });
    }
}