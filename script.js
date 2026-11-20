const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const sidebar = document.getElementById('sidebar');

function showPage(id) {
  pages.forEach(page => page.classList.toggle('active', page.id === id));
  navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === id));
  sidebar.classList.remove('open');
  window.scrollTo({top: 0, behavior: 'smooth'});
  if (id === 'exams') drawGrades();
  if (id === 'analysis') drawAnalysis();
}
navLinks.forEach(link => link.addEventListener('click', () => showPage(link.dataset.page)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.go)));
document.getElementById('menuToggle').addEventListener('click', () => sidebar.classList.toggle('open'));

const date = new Date();
document.getElementById('todayDate').textContent = date.toLocaleDateString('ar-EG', {year:'numeric', month:'long', day:'numeric'});

let gradesChart, monthlyChart, attendanceChart;
const chartDefaults = {
  responsive: true, maintainAspectRatio: false,
  plugins: {legend: {position: 'top', labels: {usePointStyle:true, boxWidth:10, font:{family:'Cairo'}}}},
  scales: {x: {grid:{display:false}, ticks:{font:{family:'Cairo'}}}, y:{beginAtZero:true, max:100, ticks:{font:{family:'Cairo'}}}}
};
function drawGrades(){
  const canvas = document.getElementById('gradesChart');
  if (!canvas || gradesChart) return;
  gradesChart = new Chart(canvas, {type:'doughnut', data:{labels:[],datasets:[{data:[],backgroundColor:['#ff854b','#4e78dc','#52bea5'],borderColor:'#fff',borderWidth:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{usePointStyle:true,font:{family:'Cairo'}}}}}});
}
function drawAnalysis(){
  if (monthlyChart) return;
  monthlyChart = new Chart(document.getElementById('monthlyChart'), {type:'line',data:{labels:[],datasets:[{label:'النسبة المئوية',data:[],borderColor:'#52bea5',backgroundColor:'#52bea522',fill:true,tension:.4,pointRadius:5}]},options:chartDefaults});
  attendanceChart = new Chart(document.getElementById('attendanceChart'), {type:'bar',data:{labels:[],datasets:[{label:'نسبة الحضور',data:[],backgroundColor:'#6250b8',borderRadius:9}]},options:chartDefaults});
}
