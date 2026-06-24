const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let estadoCaja={abierta:false,turnoId:null,montoApertura:0,ingresos:0,egresos:0};
let inventario=[
{id:1,nombre:"Hamburguesa Italiana",precio:8500,stock:50,stockMinimo:10,controla:true},
{id:2,nombre:"Papas Fritas Grandes",precio:3500,stock:30,stockMinimo:5,controla:true},
{id:3,nombre:"Bebida Lata 350cc",precio:1500,stock:100,stockMinimo:15,controla:true}
];
let pedidos=[];
let repartidores=[{id:1,nombre:"Carlos Moto",estado:"Inactivo",fondoInicial:0,efectivoAcumulado:0}];

app.post('/api/caja/apertura',(req,res)=>{
const {monto}=req.body;
if(estadoCaja.abierta)return res.status(400).json({error:"La caja ya está abierta"});
estadoCaja={abierta:true,turnoId:Date.now(),montoApertura:parseFloat(monto),ingresos:0,egresos:0};
res.json({mensaje:"Caja abierta con éxito",estadoCaja});
});

app.get('/api/caja/informe-x',(req,res)=>{
if(!estadoCaja.abierta)return res.status(400).json({error:"Caja cerrada"});
let ventasEfectivo=0,ventasTarjeta=0,totalAnulado=0;
pedidos.forEach(p=>{
if(p.turnoId===estadoCaja.turnoId){
if(p.estado==='Anulado')totalAnulado+=p.total;
else if(p.metodoPago==='Efectivo')ventasEfectivo+=p.total;
else ventasTarjeta+=p.total;
}});
const efectivoEsperado=estadoCaja.montoApertura+ventasEfectivo+estadoCaja.ingresos-estadoCaja.egresos;
res.json({turnoId:estadoCaja.turnoId,montoApertura:estadoCaja.montoApertura,ventasEfectivo,ventasTarjeta,ingresos:estadoCaja.ingresos,egresos:estadoCaja.egresos,efectivoEsperado,totalAnulado});
});

app.post('/api/caja/cierre-z',(req,res)=>{
const {efectivoReal}=req.body;
if(!estadoCaja.abierta)return res.status(400).json({error:"La caja ya está cerrada"});
const pendientes=repartidores.some(r=>r.efectivoAcumulado>0||r.estado==='En Ruta');
if(pendientes)return res.status(400).json({error:"No se puede cerrar caja: Hay repartidores con rendiciones pendientes."});
estadoCaja.abierta=false;
res.json({mensaje:"Informe Z generado. Turno cerrado oficialmente.",efectivoReal,fecha:new Date()});
});

app.post('/api/pedidos',(req,res)=>{
if(!estadoCaja.abierta)return res.status(400).json({error:"No se pueden tomar pedidos con la caja cerrada"});
const {tipo,productosPedidos,metodoPago}=req.body;
let total=0;
for(const item of productosPedidos){
const prod=inventario.find(i=>i.id===item.id);
if(prod&&prod.controla){
if(prod.stock<item.cantidad)return res.status(400).json({error:`Stock insuficiente para ${prod.nombre}`});
prod.stock-=item.cantidad;
}
if(prod)total+=prod.precio*item.cantidad;
}
const nuevoPedido={id:pedidos.length+1,turnoId:estadoCaja.turnoId,tipo,estado:tipo==='Delivery'?'Cocina':'Entregado',metodoPago,total,productos:productosPedidos};
pedidos.push(nuevoPedido);
res.json({mensaje:"Pedido procesado",pedido:nuevoPedido});
});

app.get('/api/inventario',(req,res)=>res.json(inventario));

app.get('/api/delivery/pendientes',(req,res)=>{
res.json(pedidos.filter(p=>p.tipo==='Delivery'&&p.estado==='Cocina'));
});

app.post('/api/delivery/asignar',(req,res)=>{
const {pedidoId,repartidorId}=req.body;
const pedido=pedidos.find(p=>p.id===pedidoId);
const rep=repartidores.find(r=>r.id===repartidorId);
if(!pedido||!rep)return res.status(400).json({error:"Pedido o repartidor no encontrado"});
pedido.estado='En Ruta';
pedido.repartidorId=repartidorId;
rep.estado='En Ruta';
res.json({mensaje:"Pedido en camino",pedido});
});

app.post('/api/delivery/entregar',(req,res)=>{
const {pedidoId}=req.body;
const pedido=pedidos.find(p=>p.id===pedidoId);
if(!pedido)return res.status(400).json({error:"Pedido no encontrado"});
pedido.estado='Entregado';
if(pedido.metodoPago==='Efectivo'){
const rep=repartidores.find(r=>r.id===pedido.repartidorId);
if(rep)rep.efectivoAcumulado+=pedido.total;
}
res.json({mensaje:"Pedido entregado con éxito",pedido});
});

app.post('/api/delivery/rendir',(req,res)=>{
const {repartidorId}=req.body;
const rep=repartidores.find(r=>r.id===repartidorId);
if(!rep)return res.status(400).json({error:"Repartidor no encontrado"});
estadoCaja.ingresos+=rep.efectivoAcumulado;
const montoRendido=rep.efectivoAcumulado;
rep.efectivoAcumulado=0;
rep.estado='Inactivo';
res.json({mensaje:`Rendición exitosa. Se ingresaron $${montoRendido} a la caja principal.`,montoRendido});
});

app.listen(PORT,()=>console.log(`Servidor POS corriendo en puerto ${PORT}`));
